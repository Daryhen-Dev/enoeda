-- Invitation-only self-service student enrollment. Supabase Auth owns email delivery;
-- this migration owns the application invitation lifecycle and student association.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.students
  ADD CONSTRAINT students_auth_user_id_uq UNIQUE (auth_user_id);

COMMENT ON COLUMN public.students.auth_user_id IS
  'Nullable one-to-one Supabase Auth association for self-service student accounts.';

CREATE TABLE public.student_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  email text NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  password_set_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  student_id uuid UNIQUE REFERENCES public.students(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_invitations_email_normalized_ck CHECK (email = lower(email)),
  CONSTRAINT student_invitations_state_ck CHECK (
    state IN ('pending', 'accepted', 'revoked', 'needs_review')
  ),
  CONSTRAINT student_invitations_pending_auth_ck CHECK (
    state <> 'pending' OR auth_user_id IS NOT NULL
  ),
  CONSTRAINT student_invitations_accepted_student_ck CHECK (
    state <> 'accepted' OR (student_id IS NOT NULL AND auth_user_id IS NOT NULL)
  ),
  CONSTRAINT student_invitations_auth_user_id_uq UNIQUE (auth_user_id)
);

CREATE INDEX student_invitations_branch_created_at_idx
  ON public.student_invitations (branch_id, created_at DESC);

CREATE UNIQUE INDEX student_invitations_active_email_uq
  ON public.student_invitations (lower(email))
  WHERE state IN ('pending', 'needs_review');

CREATE TRIGGER student_invitations_updated_at
  BEFORE UPDATE ON public.student_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.student_invitations IS
  'Application-owned, one-use invitation state bound to a Supabase invited Auth user. No provider token is stored.';

ALTER TABLE public.student_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Branch admins list student invitations"
  ON public.student_invitations FOR SELECT TO authenticated
  USING (
    private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id)
  );

REVOKE ALL ON TABLE public.student_invitations FROM anon, authenticated;
GRANT SELECT ON TABLE public.student_invitations TO authenticated;

CREATE FUNCTION private.student_invitation_state(
  p_state text,
  p_expires_at timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_state = 'pending' AND p_expires_at <= now() THEN 'expired'
    ELSE p_state
  END;
$$;

REVOKE ALL ON FUNCTION private.student_invitation_state(text, timestamptz) FROM public;

CREATE POLICY "Student reads own profile"
  ON public.students FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE FUNCTION public.get_my_student_enrollment_state()
RETURNS TABLE (
  state text,
  email text,
  password_set_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    private.student_invitation_state(invitation.state, invitation.expires_at),
    invitation.email,
    invitation.password_set_at
  FROM public.student_invitations AS invitation
  WHERE invitation.auth_user_id = auth.uid()
  ORDER BY invitation.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_student_enrollment_state() FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_student_enrollment_state() TO authenticated;

CREATE FUNCTION public.mark_student_invitation_password_set()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.student_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'invalid';
  END IF;

  SELECT invitation.*
  INTO v_invitation
  FROM public.student_invitations AS invitation
  WHERE invitation.auth_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  IF v_invitation.state <> 'pending' THEN
    RETURN v_invitation.state;
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RETURN 'expired';
  END IF;

  UPDATE public.student_invitations
  SET password_set_at = COALESCE(password_set_at, now())
  WHERE id = v_invitation.id;

  RETURN 'pending';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_student_invitation_password_set() FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mark_student_invitation_password_set() TO authenticated;

CREATE FUNCTION public.complete_student_enrollment(
  p_first_name text,
  p_surname text,
  p_national_id text,
  p_date_of_birth date,
  p_phone text
)
RETURNS TABLE (
  state text,
  student_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.student_invitations;
  v_branch_is_active boolean;
  v_has_conflict boolean;
  v_student_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT invitation.*
  INTO v_invitation
  FROM public.student_invitations AS invitation
  WHERE invitation.auth_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_invitation.state <> 'pending' THEN
    RETURN QUERY SELECT v_invitation.state, v_invitation.student_id;
    RETURN;
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_invitation.password_set_at IS NULL THEN
    RETURN QUERY SELECT 'password_required'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_first_name IS NULL
    OR char_length(btrim(p_first_name)) NOT BETWEEN 1 AND 100
    OR p_surname IS NULL
    OR char_length(btrim(p_surname)) NOT BETWEEN 1 AND 100
    OR p_national_id IS NULL
    OR char_length(btrim(p_national_id)) NOT BETWEEN 1 AND 30
    OR p_date_of_birth IS NULL
    OR (p_phone IS NOT NULL AND char_length(btrim(p_phone)) > 30) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT branch.is_active
  INTO v_branch_is_active
  FROM public.branches AS branch
  WHERE branch.id = v_invitation.branch_id;

  IF COALESCE(v_branch_is_active, false) = false THEN
    UPDATE public.student_invitations
    SET state = 'needs_review'
    WHERE id = v_invitation.id;

    RETURN QUERY SELECT 'needs_review'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.auth_user_id = auth.uid()
      OR lower(student.email) = v_invitation.email
      OR student.national_id = btrim(p_national_id)
  )
  INTO v_has_conflict;

  IF v_has_conflict THEN
    UPDATE public.student_invitations
    SET state = 'needs_review'
    WHERE id = v_invitation.id;

    RETURN QUERY SELECT 'needs_review'::text, NULL::uuid;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.students (
      branch_id,
      first_name,
      surname,
      national_id,
      email,
      phone,
      date_of_birth,
      is_active,
      auth_user_id
    )
    VALUES (
      v_invitation.branch_id,
      btrim(p_first_name),
      btrim(p_surname),
      btrim(p_national_id),
      v_invitation.email,
      NULLIF(btrim(p_phone), ''),
      p_date_of_birth,
      true,
      auth.uid()
    )
    RETURNING id INTO v_student_id;
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.student_invitations
      SET state = 'needs_review'
      WHERE id = v_invitation.id;

      RETURN QUERY SELECT 'needs_review'::text, NULL::uuid;
      RETURN;
  END;

  UPDATE public.student_invitations
  SET
    state = 'accepted',
    student_id = v_student_id,
    accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT 'accepted'::text, v_student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_student_enrollment(text, text, text, date, text) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.complete_student_enrollment(text, text, text, date, text) TO authenticated;

CREATE FUNCTION public.update_own_student_phone(p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_is_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: authenticated student required';
  END IF;

  IF p_phone IS NOT NULL AND char_length(btrim(p_phone)) > 30 THEN
    RAISE EXCEPTION 'invalid: phone must contain at most 30 characters';
  END IF;

  SELECT student.id, student.is_active
  INTO v_student_id, v_is_active
  FROM public.students AS student
  WHERE student.auth_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student profile not found';
  END IF;

  IF v_is_active = false THEN
    RAISE EXCEPTION 'inactive: student profile is read only';
  END IF;

  UPDATE public.students
  SET phone = NULLIF(btrim(p_phone), '')
  WHERE id = v_student_id;

  RETURN v_student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_student_phone(text) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_own_student_phone(text) TO authenticated;

COMMIT;
