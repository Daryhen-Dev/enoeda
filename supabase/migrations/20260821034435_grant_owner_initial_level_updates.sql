-- 20260821034435_grant_owner_initial_level_updates.sql
-- Allow the server RLS role to update the initial-level column while the
-- trigger enforces that only an Owner session can change it.
BEGIN;

GRANT UPDATE (initial_level_id) ON public.disciplines TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.enforce_discipline_initial_level_match()
  FROM PUBLIC, anon, authenticated;

COMMIT;
