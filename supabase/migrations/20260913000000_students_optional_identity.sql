-- Students optional identity (students-minimal-creation T1)
-- Makes public.students.national_id, email and date_of_birth nullable so a
-- student can be created with only first_name and surname. Additive and safe
-- for existing rows: every current NOT NULL value still satisfies the new
-- non-blank CHECKs, and app-layer create/update validation is unchanged here.

BEGIN;

ALTER TABLE public.students ALTER COLUMN national_id DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN date_of_birth DROP NOT NULL;

-- Empty/blank strings are rejected: an optional identity field is either a
-- real value or NULL, never "".
ALTER TABLE public.students
  ADD CONSTRAINT students_national_id_non_blank_ck
  CHECK (national_id IS NULL OR btrim(national_id) <> '');

ALTER TABLE public.students
  ADD CONSTRAINT students_email_non_blank_ck
  CHECK (email IS NULL OR btrim(email) <> '');

-- students_national_id_uq and students_email_normalized_uq (lower(email)) are
-- UNIQUE indexes and deliberately left untouched: UNIQUE never treats NULL as
-- equal to another NULL, so any number of students may omit national_id or
-- email while concrete duplicates remain rejected. Equality/containment
-- searches on these columns simply never match NULL.

COMMENT ON COLUMN public.students.national_id IS 'Optional national ID; globally unique when set, NULL when not yet provided';
COMMENT ON COLUMN public.students.email IS 'Optional email; globally unique via lower(email) when set, NULL when not yet provided';
COMMENT ON COLUMN public.students.date_of_birth IS 'Optional date of birth; NULL when not yet provided';

COMMIT;
