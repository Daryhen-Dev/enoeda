-- 20260820214118_explicit_initial_level.sql
-- Configure the initial level explicitly per discipline without rewriting history.
BEGIN;

ALTER TABLE public.disciplines
  ADD COLUMN initial_level_id uuid NULL
  REFERENCES public.discipline_levels(id) ON DELETE RESTRICT;

CREATE INDEX disciplines_initial_level_id_idx
  ON public.disciplines (initial_level_id);

COMMENT ON TABLE public.discipline_levels IS
  'Owner-managed closed level/belt catalog per discipline; initial level is configured explicitly on disciplines.';

UPDATE public.disciplines AS discipline
SET initial_level_id = (
  SELECT level.id
  FROM public.discipline_levels AS level
  WHERE level.discipline_id = discipline.id
  ORDER BY level.sort_order ASC
  LIMIT 1
)
WHERE discipline.initial_level_id IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_discipline_initial_level_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.initial_level_id IS DISTINCT FROM OLD.initial_level_id
    AND NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'only owners can change the initial level'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.initial_level_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.discipline_levels AS level
    WHERE level.id = NEW.initial_level_id
      AND level.discipline_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'initial level must belong to the discipline'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

GRANT UPDATE (initial_level_id) ON public.disciplines TO authenticated;

CREATE TRIGGER disciplines_initial_level_match
  BEFORE INSERT OR UPDATE OF initial_level_id ON public.disciplines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_discipline_initial_level_match();

CREATE OR REPLACE FUNCTION public.assign_first_discipline_level_as_initial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.disciplines
  SET initial_level_id = NEW.id
  WHERE id = NEW.discipline_id
    AND initial_level_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER discipline_levels_assign_first_initial
  AFTER INSERT ON public.discipline_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_discipline_level_as_initial();

REVOKE EXECUTE ON FUNCTION public.enforce_discipline_initial_level_match()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_first_discipline_level_as_initial()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Branch-role initial level insert on student_progress"
  ON public.student_progress;

CREATE POLICY "Branch-role initial level insert on student_progress" ON public.student_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    ( private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id))
      OR private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)) )
    AND NOT EXISTS (
      SELECT 1 FROM public.student_progress AS existing_progress
      WHERE existing_progress.student_id = student_progress.student_id
        AND existing_progress.discipline_id = student_progress.discipline_id
    )
    AND level_id = (
      SELECT discipline.initial_level_id
      FROM public.disciplines AS discipline
      WHERE discipline.id = student_progress.discipline_id
    )
  );

COMMIT;