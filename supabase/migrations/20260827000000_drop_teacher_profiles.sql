-- Release 2: Drop teacher_profiles table (gated, NOT applied remotely without approval)
--
-- Prerequisites:
-- 1. All application instances must be on Release 1+ (no reads/writes to teacher_profiles)
-- 2. Explicit maintainer approval required
-- 3. Full backup of teacher_profiles data must exist
-- 4. No down-migration path
--
-- Safety: incoming-FK preflight aborts if any foreign key still references this table.
-- DROP does NOT use CASCADE.

BEGIN;

-- FK preflight: abort if any table still references teacher_profiles
DO $$
DECLARE
  fk_count integer;
BEGIN
  SELECT count(*)
  INTO fk_count
  FROM pg_constraint
  WHERE confrelid = 'public.teacher_profiles'::regclass
    AND contype = 'f';

  IF fk_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop teacher_profiles: % incoming foreign key(s) still reference it. '
      'Resolve all FK dependencies before retrying.',
      fk_count;
  END IF;
END $$;

-- Safe to drop: no incoming FKs, no CASCADE
DROP TABLE public.teacher_profiles;

COMMIT;
