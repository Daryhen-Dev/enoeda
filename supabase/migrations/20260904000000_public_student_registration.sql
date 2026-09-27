-- Public student self-registration replaces invitation-based enrollment.
-- Historical invitation migrations remain immutable; this forward migration removes their live artifacts.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN activation_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.students
  ADD CONSTRAINT students_activation_status_ck
  CHECK (activation_status IN ('pending', 'active'));

COMMENT ON COLUMN public.students.activation_status IS
  'Operational activation state. pending limits a self-registered student to profile access; is_active remains the suspension flag.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.students
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce normalized student email uniqueness while duplicate email values exist.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX students_email_normalized_uq
  ON public.students (lower(email));

CREATE TABLE private.public_registration_altcha_nonces (
  nonce_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_registration_altcha_nonces_hash_ck
    CHECK (nonce_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX public_registration_altcha_nonces_expires_at_idx
  ON private.public_registration_altcha_nonces (expires_at);

CREATE TABLE private.public_registration_rate_limits (
  subject_type text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  CONSTRAINT public_registration_rate_limits_subject_type_ck
    CHECK (subject_type IN ('email', 'ip')),
  CONSTRAINT public_registration_rate_limits_subject_hash_ck
    CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_registration_rate_limits_attempt_count_ck
    CHECK (attempt_count >= 1),
  PRIMARY KEY (subject_type, subject_hash, window_started_at)
);

CREATE INDEX public_registration_rate_limits_window_started_at_idx
  ON private.public_registration_rate_limits (window_started_at);

REVOKE ALL ON TABLE private.public_registration_altcha_nonces
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.public_registration_rate_limits
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_public_student_registration_altcha_nonce(
  p_nonce_hash text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  IF p_nonce_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid ALTCHA nonce hash';
  END IF;

  IF p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + interval '15 minutes' THEN
    RETURN false;
  END IF;

  WITH expired_rows AS (
    SELECT ctid
    FROM private.public_registration_altcha_nonces
    WHERE expires_at <= clock_timestamp()
    ORDER BY expires_at
    LIMIT 200
  )
  DELETE FROM private.public_registration_altcha_nonces AS nonce
  USING expired_rows
  WHERE nonce.ctid = expired_rows.ctid;

  INSERT INTO private.public_registration_altcha_nonces (nonce_hash, expires_at)
  VALUES (p_nonce_hash, p_expires_at)
  ON CONFLICT (nonce_hash) DO NOTHING
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_student_registration_altcha_nonce(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_public_student_registration_altcha_nonce(text, timestamptz)
  TO service_role;

CREATE FUNCTION public.consume_public_student_registration_rate_limit(
  p_email_hash text,
  p_ip_hash text,
  p_window_seconds integer,
  p_max_attempts integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window_started_at timestamptz;
  v_consumed_count integer;
BEGIN
  IF p_email_hash !~ '^[0-9a-f]{64}$'
    OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid public registration rate-limit hash';
  END IF;

  IF p_window_seconds < 60 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid public registration rate-limit window';
  END IF;

  IF p_max_attempts < 1 OR p_max_attempts > 100 THEN
    RAISE EXCEPTION 'invalid public registration rate-limit maximum';
  END IF;

  v_window_started_at := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  WITH expired_rows AS (
    SELECT ctid
    FROM private.public_registration_rate_limits
    WHERE window_started_at < clock_timestamp() - interval '2 hours'
    ORDER BY window_started_at
    LIMIT 200
  )
  DELETE FROM private.public_registration_rate_limits AS rate_limit
  USING expired_rows
  WHERE rate_limit.ctid = expired_rows.ctid;

  WITH subjects (subject_type, subject_hash) AS (
    VALUES ('email'::text, p_email_hash), ('ip'::text, p_ip_hash)
  ), consumed AS (
    INSERT INTO private.public_registration_rate_limits AS rate_limit (
      subject_type,
      subject_hash,
      window_started_at,
      attempt_count
    )
    SELECT subject_type, subject_hash, v_window_started_at, 1
    FROM subjects
    ON CONFLICT (subject_type, subject_hash, window_started_at)
    DO UPDATE SET attempt_count = rate_limit.attempt_count + 1
    WHERE rate_limit.attempt_count < p_max_attempts
    RETURNING subject_type
  )
  SELECT count(*) INTO v_consumed_count
  FROM consumed;

  RETURN v_consumed_count = 2;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_student_registration_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_student_registration_rate_limit(text, text, integer, integer)
  TO service_role;

-- Preserve accepted student accounts, but remove Auth accounts created solely for unaccepted invitations.
DELETE FROM auth.users AS auth_user
USING public.student_invitations AS invitation
WHERE invitation.auth_user_id = auth_user.id
  AND invitation.student_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.auth_user_id = auth_user.id
  );

DROP FUNCTION IF EXISTS public.get_my_student_enrollment_state();
DROP FUNCTION IF EXISTS public.mark_student_invitation_password_set();
DROP FUNCTION IF EXISTS public.complete_student_enrollment(text, text, text, date, text);
DROP FUNCTION IF EXISTS private.student_invitation_state(text, timestamptz);
DROP TABLE public.student_invitations;

COMMIT;
