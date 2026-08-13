-- Owner Role Management: re-authorize RPCs to owner-only,
-- reject 'owner' as a target, add list_staff() RPC, add owner SELECT policy,
-- enforce single-active-owner invariant via partial unique index.

-- 0. Single active owner invariant
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_single_active_owner
  ON public.user_roles (role)
  WHERE role = 'owner'::public.role_enum AND revoked_at IS NULL;

-- 1. Redefine grant_role: owner-only + reject p_role = 'owner'
-- Race-safe idempotency via INSERT ... ON CONFLICT DO NOTHING + active read.
CREATE OR REPLACE FUNCTION public.grant_role(p_target_user_id uuid, p_role public.role_enum)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'unauthorized: owner role required';
  END IF;

  IF p_role = 'owner'::public.role_enum THEN
    RAISE EXCEPTION 'forbidden: owner role is not assignable';
  END IF;

  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (p_target_user_id, p_role, auth.uid())
  ON CONFLICT (user_id, role) WHERE revoked_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  -- If INSERT did nothing (idempotent case), read back the existing active row
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.user_roles
    WHERE user_id = p_target_user_id
      AND role = p_role
      AND revoked_at IS NULL;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_role(uuid, public.role_enum) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, public.role_enum) TO authenticated;

-- 2. Redefine revoke_role: owner-only + reject p_role = 'owner'
CREATE OR REPLACE FUNCTION public.revoke_role(p_target_user_id uuid, p_role public.role_enum)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'unauthorized: owner role required';
  END IF;

  IF p_role = 'owner'::public.role_enum THEN
    RAISE EXCEPTION 'forbidden: owner role is not revocable';
  END IF;

  UPDATE public.user_roles
  SET revoked_by = auth.uid(), revoked_at = now()
  WHERE user_id = p_target_user_id
    AND role = p_role
    AND revoked_at IS NULL;

  RETURN found;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, public.role_enum) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, public.role_enum) TO authenticated;

-- 3. Drop legacy admin policy; create owner-only SELECT policy (active rows only)
DROP POLICY IF EXISTS "Admin can read all roles" ON public.user_roles;

CREATE POLICY "Owner can read active roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'owner'::public.role_enum)
    AND revoked_at IS NULL
  );

-- The existing "Users can read own active roles" policy continues to provide
-- self-read access. Do not duplicate it under a new policy name.

-- 4. list_staff(): owner-only SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE(user_id uuid, role public.role_enum, assigned_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'unauthorized: owner role required';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, ur.role, ur.assigned_at
  FROM public.user_roles ur
  WHERE ur.revoked_at IS NULL
  ORDER BY ur.assigned_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_staff() FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;
