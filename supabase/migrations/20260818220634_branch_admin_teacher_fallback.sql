-- 20260828000001_branch_admin_teacher_fallback.sql
BEGIN;

CREATE OR REPLACE FUNCTION private.ensure_branch_teacher_fallback(
  p_branch_id uuid,
  p_excluded_teacher_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_locked_branch_id uuid;
  v_teacher_id uuid;
BEGIN
  SELECT b.id
  INTO v_locked_branch_id
  FROM public.branches b
  WHERE b.id = p_branch_id
  FOR UPDATE;

  IF v_locked_branch_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ur.user_id
  INTO v_teacher_id
  FROM public.user_roles ur
  WHERE ur.branch_id = p_branch_id
    AND ur.role = 'teacher'::public.role_enum
    AND ur.revoked_at IS NULL
    AND (p_excluded_teacher_id IS NULL OR ur.user_id <> p_excluded_teacher_id)
  ORDER BY ur.assigned_at ASC, ur.id ASC
  LIMIT 1;

  IF v_teacher_id IS NOT NULL THEN
    RETURN v_teacher_id;
  END IF;

  SELECT ur.user_id
  INTO v_teacher_id
  FROM public.user_roles ur
  WHERE ur.branch_id = p_branch_id
    AND ur.role = 'admin'::public.role_enum
    AND ur.revoked_at IS NULL
    AND (p_excluded_teacher_id IS NULL OR ur.user_id <> p_excluded_teacher_id)
  ORDER BY ur.assigned_at ASC, ur.id ASC
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by)
  VALUES (v_teacher_id, 'teacher'::public.role_enum, p_branch_id, auth.uid())
  ON CONFLICT (user_id, role, branch_id) WHERE revoked_at IS NULL
  DO NOTHING;

  INSERT INTO public.branch_default_teachers (branch_id, teacher_id)
  VALUES (p_branch_id, v_teacher_id)
  ON CONFLICT (branch_id) DO UPDATE
  SET teacher_id = EXCLUDED.teacher_id, updated_at = now();

  RETURN v_teacher_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.ensure_branch_teacher_fallback(uuid, uuid) FROM public;

CREATE OR REPLACE FUNCTION public.assign_branch_admin(
  p_target uuid,
  p_branch_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_target_exists boolean;
BEGIN
  IF NOT private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    RAISE EXCEPTION 'unauthorized: owner role required';
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target)
  INTO v_target_exists;
  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target user does not exist in auth.users';
  END IF;

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by)
  VALUES (p_target, 'admin'::public.role_enum, p_branch_id, auth.uid())
  ON CONFLICT (user_id, role, branch_id) WHERE revoked_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id
    INTO v_id
    FROM public.user_roles
    WHERE user_id = p_target
      AND role = 'admin'::public.role_enum
      AND branch_id = p_branch_id
      AND revoked_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE branch_id = p_branch_id
      AND role = 'teacher'::public.role_enum
      AND revoked_at IS NULL
  ) THEN
    PERFORM private.ensure_branch_teacher_fallback(p_branch_id);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_branch_admin(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assign_branch_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_teacher_with_reassignment(
  p_target_user_id uuid,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_repl uuid;
  v_cut timestamptz := now();
  v_c RECORD;
  v_cs jsonb := '[]';
  v_n int := 0;
BEGIN
  IF NOT (
    private.has_role(auth.uid(), 'owner'::public.role_enum)
    OR private.has_branch_role(auth.uid(), 'admin'::public.role_enum, p_branch_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized: insufficient privileges to revoke teacher';
  END IF;

  v_repl := private.ensure_branch_teacher_fallback(
    p_branch_id,
    p_target_user_id
  );
  IF v_repl IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'no_active_admin');
  END IF;

  FOR v_c IN
    SELECT sc.id AS class_id, sc.day_of_week, sc.start_time::text AS start_time
    FROM public.scheduled_classes sc
    WHERE sc.branch_id = p_branch_id
      AND sc.is_active = true
      AND sc.default_teacher_id = p_target_user_id
      AND EXISTS (
        SELECT 1
        FROM public.scheduled_classes sc2
        WHERE sc2.branch_id = p_branch_id
          AND sc2.is_active = true
          AND sc2.default_teacher_id = v_repl
          AND sc2.day_of_week = sc.day_of_week
          AND sc2.id <> sc.id
          AND public.class_time_range(
            sc2.start_time,
            (sc2.start_time + interval '1 hour')::time,
            '[)'
          ) && public.class_time_range(
            sc.start_time,
            (sc.start_time + interval '1 hour')::time,
            '[)'
          )
      )
  LOOP
    v_cs := v_cs || jsonb_build_object(
      'classId', v_c.class_id,
      'dayOfWeek', v_c.day_of_week,
      'startTime', v_c.start_time
    );
  END LOOP;

  IF jsonb_array_length(v_cs) > 0 THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'reason', 'conflict',
      'conflicts', v_cs
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branch_default_teachers bdt
    WHERE bdt.branch_id = p_branch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.branch_default_teachers bdt
    WHERE bdt.branch_id = p_branch_id
      AND bdt.teacher_id = p_target_user_id
  ) THEN
    INSERT INTO public.branch_default_teachers (branch_id, teacher_id)
    VALUES (p_branch_id, v_repl)
    ON CONFLICT (branch_id) DO UPDATE
    SET teacher_id = EXCLUDED.teacher_id, updated_at = now();
  END IF;

  UPDATE public.teacher_attribution_periods
  SET effective_until = v_cut
  WHERE teacher_id = p_target_user_id
    AND effective_until IS NULL
    AND scheduled_class_id IN (
      SELECT id
      FROM public.scheduled_classes
      WHERE branch_id = p_branch_id
        AND is_active = true
    );

  INSERT INTO public.teacher_attribution_periods (
    scheduled_class_id,
    teacher_id,
    effective_from
  )
  SELECT sc.id, v_repl, v_cut
  FROM public.scheduled_classes sc
  WHERE sc.branch_id = p_branch_id
    AND sc.is_active = true
    AND sc.default_teacher_id = p_target_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.class_sessions cs
  SET assigned_teacher_id = v_repl
  FROM public.scheduled_classes sc
  WHERE sc.id = cs.scheduled_class_id
    AND sc.branch_id = p_branch_id
    AND sc.is_active = true
    AND cs.assigned_teacher_id = p_target_user_id
    AND (cs.session_date + sc.start_time) AT TIME ZONE 'America/Guayaquil' >= v_cut;

  UPDATE public.scheduled_classes
  SET default_teacher_id = v_repl
  WHERE branch_id = p_branch_id
    AND is_active = true
    AND default_teacher_id = p_target_user_id;

  UPDATE public.user_roles
  SET revoked_by = auth.uid(), revoked_at = now()
  WHERE user_id = p_target_user_id
    AND role = 'teacher'::public.role_enum
    AND branch_id = p_branch_id
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'status', 'revoked',
    'reassignedClassCount', v_n,
    'cutoff', v_cut
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_teacher_with_reassignment(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_teacher_with_reassignment(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_branch_role(
  p_target uuid,
  p_role public.role_enum,
  p_branch_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_role = 'owner'::public.role_enum THEN
    RAISE EXCEPTION 'forbidden: owner role is not revocable via this RPC';
  END IF;

  IF private.has_role(auth.uid(), 'owner'::public.role_enum) THEN
    NULL;
  ELSIF private.has_branch_role(auth.uid(), 'admin'::public.role_enum, p_branch_id) THEN
    IF p_role <> 'teacher'::public.role_enum THEN
      RAISE EXCEPTION 'unauthorized: admin can only revoke teacher roles in own branch';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized: insufficient privileges to revoke roles';
  END IF;

  IF p_role = 'teacher'::public.role_enum THEN
    v_result := public.revoke_teacher_with_reassignment(p_target, p_branch_id);
    IF v_result ->> 'status' = 'revoked' THEN
      RETURN true;
    END IF;

    RAISE EXCEPTION 'teacher revocation blocked: %', v_result ->> 'reason';
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

DO $$
DECLARE
  v_branch_id uuid;
BEGIN
  FOR v_branch_id IN
    SELECT b.id
    FROM public.branches b
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.branch_id = b.id
        AND ur.role = 'teacher'::public.role_enum
        AND ur.revoked_at IS NULL
    )
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.branch_id = b.id
          AND ur.role = 'admin'::public.role_enum
          AND ur.revoked_at IS NULL
      )
  LOOP
    PERFORM private.ensure_branch_teacher_fallback(v_branch_id);
  END LOOP;
END;
$$;

COMMIT;
