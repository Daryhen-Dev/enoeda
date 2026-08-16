-- Canonical operator identity profiles. teacher_profiles remains branch roster data.

BEGIN;

CREATE TABLE public.user_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    text NOT NULL,
  surname       text NOT NULL,
  phone         text,
  date_of_birth date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_first_name_len_ck CHECK (char_length(first_name) BETWEEN 1 AND 100),
  CONSTRAINT user_profiles_surname_len_ck CHECK (char_length(surname) BETWEEN 1 AND 100),
  CONSTRAINT user_profiles_phone_len_ck CHECK (phone IS NULL OR char_length(phone) <= 30)
);

COMMENT ON TABLE public.user_profiles IS 'Canonical identity profile for Admin and Teacher users; never branch-scoped.';

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.user_profiles (
  user_id,
  first_name,
  surname,
  phone,
  date_of_birth,
  created_at,
  updated_at
)
SELECT
  user_id,
  first_name,
  surname,
  phone,
  date_of_birth,
  created_at,
  updated_at
FROM public.teacher_profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admin or Teacher reads own user profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::public.role_enum)
      OR private.has_role(auth.uid(), 'teacher'::public.role_enum)
    )
  );

CREATE POLICY "Admin or Teacher updates own user profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::public.role_enum)
      OR private.has_role(auth.uid(), 'teacher'::public.role_enum)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::public.role_enum)
      OR private.has_role(auth.uid(), 'teacher'::public.role_enum)
    )
  );

REVOKE ALL ON TABLE public.user_profiles FROM anon;
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO authenticated;

CREATE FUNCTION public.ensure_own_user_profile(
  p_first_name text,
  p_surname text,
  p_phone text,
  p_date_of_birth date
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: authenticated user required';
  END IF;

  IF NOT (
    private.has_role(auth.uid(), 'admin'::public.role_enum)
    OR private.has_role(auth.uid(), 'teacher'::public.role_enum)
  ) THEN
    RAISE EXCEPTION 'unauthorized: admin or teacher role required';
  END IF;

  INSERT INTO public.user_profiles (
    user_id,
    first_name,
    surname,
    phone,
    date_of_birth
  )
  VALUES (
    auth.uid(),
    p_first_name,
    p_surname,
    NULLIF(p_phone, ''),
    p_date_of_birth
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_profile;

  IF v_profile.user_id IS NULL THEN
    SELECT *
    INTO v_profile
    FROM public.user_profiles
    WHERE user_id = auth.uid();
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_own_user_profile(text, text, text, date) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_own_user_profile(text, text, text, date) TO authenticated;

COMMIT;
