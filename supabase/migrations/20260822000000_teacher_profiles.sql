-- Teacher profile data: first name, surname, phone, date of birth.
--
-- Teachers were previously identified only by their auth.users email —
-- never intended as a long-term identity (see product decision). This
-- table adds real profile fields, created alongside the teacher account
-- by the branch admin (createBranchTeacher). One row per teacher user
-- (1:1 with auth.users). branch_id is denormalized at creation time to
-- keep RLS scoping simple and consistent with the existing branch-scoped
-- pattern (mirrors user_roles.branch_id).

BEGIN;

CREATE TABLE public.teacher_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  first_name    text NOT NULL,
  surname       text NOT NULL,
  phone         text,
  date_of_birth date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_profiles_first_name_len_ck CHECK (char_length(first_name) BETWEEN 1 AND 100),
  CONSTRAINT teacher_profiles_surname_len_ck CHECK (char_length(surname) BETWEEN 1 AND 100),
  CONSTRAINT teacher_profiles_phone_len_ck CHECK (phone IS NULL OR char_length(phone) <= 30)
);
CREATE INDEX teacher_profiles_branch_id_idx ON public.teacher_profiles (branch_id);
COMMENT ON TABLE public.teacher_profiles IS 'Teacher identity fields (name/phone/date of birth), 1:1 with auth.users; never treat email as the teacher identity';

-- updated_at trigger (reuse existing public.set_updated_at)
CREATE TRIGGER teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Owner full access; Admin branch-scoped read+write; Teacher reads own row.
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on teacher_profiles"
  ON public.teacher_profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on teacher_profiles"
  ON public.teacher_profiles FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

CREATE POLICY "Teacher reads own profile"
  ON public.teacher_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Grants (defense in depth; RLS is the authority)
REVOKE INSERT, UPDATE, DELETE ON public.teacher_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;

COMMIT;
