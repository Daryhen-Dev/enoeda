BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_active_student_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_branch_is_active boolean;
BEGIN
  IF NEW.is_active THEN
    SELECT branch.is_active
    INTO target_branch_is_active
    FROM public.branches AS branch
    WHERE branch.id = NEW.branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active students must be assigned to an existing branch'
        USING ERRCODE = '23514';
    END IF;

    IF target_branch_is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Active students must be assigned to an active branch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_active_student_branch() FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Teacher branch-scoped insert on discipline_events" ON public.discipline_events;

CREATE POLICY "Teacher branch-scoped insert on discipline_events"
  ON public.discipline_events FOR INSERT TO authenticated
  WITH CHECK (
    private.has_branch_role(
      auth.uid(),
      'teacher'::public.role_enum,
      private.student_branch_id((
        SELECT student_discipline.student_id
        FROM public.student_disciplines AS student_discipline
        WHERE student_discipline.id = student_discipline_id
      ))
    )
    AND performed_by = (SELECT auth.uid())
  );

COMMIT;
