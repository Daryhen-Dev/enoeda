-- Branch-Scoped Roles: Supersedes flat grant_role/revoke_role/list_staff RPCs
-- and flat branch/student RLS with branch-scoped hierarchy.
--
-- Capabilities realized:
--   - owner: global (branch_id NULL), full control
--   - admin: branch-scoped write + cross-branch read
--   - teacher: branch-scoped read only

BEGIN;

-- =============================================================================
-- 1. Add branch_id FK + index to user_roles
-- =============================================================================

ALTER TABLE public.user_roles
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT;

CREATE INDEX user_roles_branch_id_idx ON public.user_roles (branch_id);

-- =============================================================================
-- 2. CHECK constraint: owner ⇒ branch_id NULL; admin/teacher ⇒ branch_id NOT NULL
-- =============================================================================

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_branch_scope_ck CHECK (
    (role = 'owner'::public.role_enum AND branch_id IS NULL)
    OR
    (role IN ('admin'::public.role_enum, 'teacher'::public.role_enum) AND branch_id IS NOT NULL)
  ) NOT VALID;

-- Validate separately (allows existing revoked rows without branch_id to fail
-- loudly if they exist — migration guard per design)
ALTER TABLE public.user_roles VALIDATE CONSTRAINT user_roles_branch_scope_ck;

-- =============================================================================
-- 3. DROP old unique index; CREATE branch-aware active-uniqueness
-- =============================================================================

DROP INDEX IF EXISTS public.user_roles_active_uq;
DROP INDEX IF EXISTS public.uq_user_roles_single_active_owner;

CREATE UNIQUE INDEX user_roles_active_uq
  ON public.user_roles (user_id, role, branch_id)
  WHERE revoked_at IS NULL;

-- Single active owner invariant (branch_id IS NULL for owner, so separate partial)
CREATE UNIQUE INDEX uq_user_roles_single_active_owner
  ON public.user_roles (role)
  WHERE role = 'owner'::public.role_enum AND revoked_at IS NULL;

-- =============================================================================
-- 4. private.has_branch_role(uid, p_role, p_branch_id) → boolean
-- =============================================================================

CREATE OR REPLACE FUNCTION private.has_branch_role(
  p_user_id uuid,
  p_role public.role_enum,
  p_branch_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role
      AND branch_id = p_branch_id
      AND revoked_at IS NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION private.has_branch_role(uuid, public.role_enum, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.has_branch_role(uuid, public.role_enum, uuid) TO authenticated;

-- =============================================================================
-- 5. private.has_any_admin_role(uid) → boolean (cross-branch read)
-- =============================================================================

CREATE OR REPLACE FUNCTION private.has_any_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'admin'::public.role_enum
      AND revoked_at IS NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION private.has_any_admin_role(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.has_any_admin_role(uuid) TO authenticated;

-- =============================================================================
-- 6. RPC: assign_branch_admin(p_target, p_branch_id) — owner-only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_branch_admin(
  p_target uuid,
  p_branch_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_target_exists boolean;
BEGIN
  -- Caller must be owner
  IF NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'unauthorized: owner role required';
  END IF;

  -- Validate target exists in auth.users
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target)
    INTO v_target_exists;
  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target user does not exist in auth.users';
  END IF;

  -- Idempotent insert
  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by)
  VALUES (p_target, 'admin'::public.role_enum, p_branch_id, auth.uid())
  ON CONFLICT (user_id, role, branch_id) WHERE revoked_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  -- If INSERT did nothing (already exists), read back
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.user_roles
    WHERE user_id = p_target
      AND role = 'admin'::public.role_enum
      AND branch_id = p_branch_id
      AND revoked_at IS NULL;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_branch_admin(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assign_branch_admin(uuid, uuid) TO authenticated;

-- =============================================================================
-- 7. RPC: assign_branch_teacher(p_target, p_branch_id) — admin-of-branch only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_branch_teacher(
  p_target uuid,
  p_branch_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_target_exists boolean;
BEGIN
  -- Caller must be admin of the specified branch
  IF NOT private.has_branch_role(auth.uid(), 'admin'::public.role_enum, p_branch_id) THEN
    RAISE EXCEPTION 'unauthorized: admin role on this branch required';
  END IF;

  -- Validate target exists in auth.users
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target)
    INTO v_target_exists;
  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target user does not exist in auth.users';
  END IF;

  -- Idempotent insert
  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by)
  VALUES (p_target, 'teacher'::public.role_enum, p_branch_id, auth.uid())
  ON CONFLICT (user_id, role, branch_id) WHERE revoked_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  -- If INSERT did nothing (already exists), read back
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.user_roles
    WHERE user_id = p_target
      AND role = 'teacher'::public.role_enum
      AND branch_id = p_branch_id
      AND revoked_at IS NULL;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_branch_teacher(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assign_branch_teacher(uuid, uuid) TO authenticated;

-- =============================================================================
-- 8. RPC: revoke_branch_role(p_target, p_role, p_branch_id)
--    Owner: any role except 'owner'; Admin: teacher in own branch only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.revoke_branch_role(
  p_target uuid,
  p_role public.role_enum,
  p_branch_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Never allow revoking 'owner' through this RPC
  IF p_role = 'owner'::public.role_enum THEN
    RAISE EXCEPTION 'forbidden: owner role is not revocable via this RPC';
  END IF;

  -- Authorization: owner can revoke any branch role; admin can revoke teacher in own branch
  IF private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    -- Owner authorized for any non-owner role
    NULL;
  ELSIF private.has_branch_role(auth.uid(), 'admin'::public.role_enum, p_branch_id) THEN
    -- Admin can only revoke teacher in their own branch
    IF p_role <> 'teacher'::public.role_enum THEN
      RAISE EXCEPTION 'unauthorized: admin can only revoke teacher roles in own branch';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized: insufficient privileges to revoke roles';
  END IF;

  UPDATE public.user_roles
  SET revoked_by = auth.uid(), revoked_at = now()
  WHERE user_id = p_target
    AND role = p_role
    AND branch_id = p_branch_id
    AND revoked_at IS NULL;

  RETURN found;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_branch_role(uuid, public.role_enum, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_branch_role(uuid, public.role_enum, uuid) TO authenticated;

-- =============================================================================
-- 9. DROP + CREATE current_roles() → TABLE(role, branch_id)
--    Return-type change requires DROP (cannot ALTER return type)
-- =============================================================================

DROP FUNCTION IF EXISTS public.current_roles();

CREATE FUNCTION public.current_roles()
RETURNS TABLE(role public.role_enum, branch_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT ur.role, ur.branch_id
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.revoked_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.current_roles() FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_roles() TO authenticated;

-- =============================================================================
-- 10. Rewrite branch RLS policies
--     Owner: ALL; Admin: branch-scoped write; Admin: global SELECT (read-only);
--     Teacher: branch-scoped SELECT
-- =============================================================================

-- Drop existing flat policies on branches
DROP POLICY IF EXISTS "Admin full access on branches" ON public.branches;
DROP POLICY IF EXISTS "Teacher read branches" ON public.branches;

-- Owner: full access to all branches
CREATE POLICY "Owner full access on branches"
  ON public.branches FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- Admin: branch-scoped ALL (write) — admin can CUD on their own branch
CREATE POLICY "Admin branch-scoped write on branches"
  ON public.branches FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, id));

-- Admin: global SELECT (cross-branch read visibility)
CREATE POLICY "Admin global read on branches"
  ON public.branches FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

-- Teacher: branch-scoped SELECT only
CREATE POLICY "Teacher branch-scoped read on branches"
  ON public.branches FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, id));

-- =============================================================================
-- 11. Rewrite student RLS policies (same pattern as branches)
-- =============================================================================

-- Drop existing flat policies on students
DROP POLICY IF EXISTS "Admin full access on students" ON public.students;
DROP POLICY IF EXISTS "Teacher read students" ON public.students;

-- Owner: full access to all students
CREATE POLICY "Owner full access on students"
  ON public.students FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- Admin: branch-scoped ALL (write) on students in their branch
CREATE POLICY "Admin branch-scoped write on students"
  ON public.students FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

-- Admin: global SELECT on all students (cross-branch read)
CREATE POLICY "Admin global read on students"
  ON public.students FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

-- Teacher: branch-scoped SELECT only
CREATE POLICY "Teacher branch-scoped read on students"
  ON public.students FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

-- =============================================================================
-- 12. Drop superseded flat RPCs (grant_role, revoke_role, list_staff)
-- =============================================================================

DROP FUNCTION IF EXISTS public.grant_role(uuid, public.role_enum);
DROP FUNCTION IF EXISTS public.revoke_role(uuid, public.role_enum);
DROP FUNCTION IF EXISTS public.list_staff();

COMMIT;
