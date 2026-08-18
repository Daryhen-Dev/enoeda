-- 20260828000000_default_teacher_reassignment.sql
-- Tables, resolver, RPCs, RLS, grants, backfill. Timezone: America/Guayaquil (UTC-5).
BEGIN;

-- 1. branch_default_teachers — one default per branch
CREATE TABLE public.branch_default_teachers (
  branch_id  uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER branch_default_teachers_updated_at BEFORE UPDATE ON public.branch_default_teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. teacher_attribution_periods — time-effective teacher per class
CREATE TABLE public.teacher_attribution_periods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id uuid NOT NULL REFERENCES public.scheduled_classes(id) ON DELETE CASCADE,
  teacher_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  effective_from     timestamptz NOT NULL,
  effective_until    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now());
CREATE INDEX teacher_attribution_periods_class_from_idx
  ON public.teacher_attribution_periods (scheduled_class_id, effective_from);

-- 3. private.resolve_effective_teacher — override → period → fallback
CREATE OR REPLACE FUNCTION private.resolve_effective_teacher(
  p_class_id uuid, p_session_date date
) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r uuid; v_occ timestamptz; v_st time;
BEGIN
  SELECT cs.assigned_teacher_id INTO v_r FROM public.class_sessions cs
  WHERE cs.scheduled_class_id=p_class_id AND cs.session_date=p_session_date AND cs.assigned_teacher_id IS NOT NULL;
  IF v_r IS NOT NULL THEN RETURN v_r; END IF;
  SELECT sc.start_time INTO v_st FROM public.scheduled_classes sc WHERE sc.id=p_class_id;
  IF v_st IS NULL THEN
    SELECT sc.default_teacher_id INTO v_r FROM public.scheduled_classes sc WHERE sc.id=p_class_id; RETURN v_r;
  END IF;
  v_occ := (p_session_date + v_st) AT TIME ZONE 'America/Guayaquil';
  SELECT tap.teacher_id INTO v_r FROM public.teacher_attribution_periods tap
  WHERE tap.scheduled_class_id=p_class_id AND tap.effective_from<=v_occ
    AND (tap.effective_until IS NULL OR tap.effective_until>v_occ)
  ORDER BY tap.effective_from DESC LIMIT 1;
  IF v_r IS NOT NULL THEN RETURN v_r; END IF;
  SELECT sc.default_teacher_id INTO v_r FROM public.scheduled_classes sc WHERE sc.id=p_class_id;
  RETURN v_r;
END;$$;
REVOKE EXECUTE ON FUNCTION private.resolve_effective_teacher(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION private.resolve_effective_teacher(uuid, date) TO authenticated;

-- 4. Rewrite is_session_teacher → delegates to resolve_effective_teacher
CREATE OR REPLACE FUNCTION private.is_session_teacher(
  p_user_id uuid, p_scheduled_class_id uuid, p_session_date date
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.resolve_effective_teacher(p_scheduled_class_id, p_session_date) = p_user_id;
$$;

-- 5. set_branch_default_teacher — validates active same-branch teacher
CREATE OR REPLACE FUNCTION public.set_branch_default_teacher(
  p_branch_id uuid, p_teacher_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.has_role(auth.uid(),'owner'::public.role_enum)
    OR private.has_branch_role(auth.uid(),'admin'::public.role_enum,p_branch_id)) THEN
    RAISE EXCEPTION 'unauthorized: insufficient privileges';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id=p_teacher_id AND role='teacher'::public.role_enum
      AND branch_id=p_branch_id AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'invalid: teacher must have an active teacher role in this branch';
  END IF;
  INSERT INTO public.branch_default_teachers (branch_id, teacher_id) VALUES (p_branch_id, p_teacher_id)
  ON CONFLICT (branch_id) DO UPDATE SET teacher_id=EXCLUDED.teacher_id, updated_at=now();
END;$$;
REVOKE EXECUTE ON FUNCTION public.set_branch_default_teacher(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_branch_default_teacher(uuid, uuid) TO authenticated;

-- 6. revoke_teacher_with_reassignment — atomic validate/conflict/close/open/rewrite/revoke
CREATE OR REPLACE FUNCTION public.revoke_teacher_with_reassignment(
  p_target_user_id uuid, p_branch_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_repl uuid; v_cut timestamptz:=now(); v_c RECORD; v_cs jsonb:='[]'; v_n int:=0;
BEGIN
  IF NOT (private.has_role(auth.uid(),'owner'::public.role_enum)
    OR private.has_branch_role(auth.uid(),'admin'::public.role_enum,p_branch_id)) THEN
    RAISE EXCEPTION 'unauthorized: insufficient privileges to revoke teacher';
  END IF;
  SELECT bdt.teacher_id INTO v_repl FROM public.branch_default_teachers bdt WHERE bdt.branch_id=p_branch_id;
  IF v_repl IS NULL THEN RETURN jsonb_build_object('status','blocked','reason','no_default_teacher'); END IF;
  IF v_repl=p_target_user_id THEN RETURN jsonb_build_object('status','blocked','reason','revoked_is_default'); END IF;
  FOR v_c IN
    SELECT sc.id AS class_id, sc.day_of_week, sc.start_time::text AS start_time
    FROM public.scheduled_classes sc
    WHERE sc.branch_id=p_branch_id AND sc.is_active=true AND sc.default_teacher_id=p_target_user_id
      AND EXISTS (SELECT 1 FROM public.scheduled_classes sc2
        WHERE sc2.branch_id=p_branch_id AND sc2.is_active=true AND sc2.default_teacher_id=v_repl
          AND sc2.day_of_week=sc.day_of_week AND sc2.id<>sc.id
          AND public.class_time_range(sc2.start_time,(sc2.start_time+interval '1 hour')::time,'[)')
           && public.class_time_range(sc.start_time,(sc.start_time+interval '1 hour')::time,'[)'))
  LOOP v_cs:=v_cs||jsonb_build_object('classId',v_c.class_id,'dayOfWeek',v_c.day_of_week,'startTime',v_c.start_time);
  END LOOP;
  IF jsonb_array_length(v_cs)>0 THEN RETURN jsonb_build_object('status','blocked','reason','conflict','conflicts',v_cs); END IF;
  UPDATE public.teacher_attribution_periods SET effective_until=v_cut
  WHERE teacher_id=p_target_user_id AND effective_until IS NULL
    AND scheduled_class_id IN (SELECT id FROM public.scheduled_classes WHERE branch_id=p_branch_id AND is_active=true);
  INSERT INTO public.teacher_attribution_periods (scheduled_class_id, teacher_id, effective_from)
  SELECT sc.id, v_repl, v_cut FROM public.scheduled_classes sc
  WHERE sc.branch_id=p_branch_id AND sc.is_active=true AND sc.default_teacher_id=p_target_user_id;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  UPDATE public.class_sessions cs SET assigned_teacher_id=v_repl
  FROM public.scheduled_classes sc
  WHERE sc.id=cs.scheduled_class_id AND sc.branch_id=p_branch_id AND sc.is_active=true
    AND cs.assigned_teacher_id=p_target_user_id
    AND (cs.session_date + sc.start_time) AT TIME ZONE 'America/Guayaquil' >= v_cut;
  UPDATE public.scheduled_classes SET default_teacher_id=v_repl
  WHERE branch_id=p_branch_id AND is_active=true AND default_teacher_id=p_target_user_id;
  PERFORM public.revoke_branch_role(p_target_user_id,'teacher'::public.role_enum,p_branch_id);
  RETURN jsonb_build_object('status','revoked','reassignedClassCount',v_n,'cutoff',v_cut);
END;$$;
REVOKE EXECUTE ON FUNCTION public.revoke_teacher_with_reassignment(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_teacher_with_reassignment(uuid, uuid) TO authenticated;

-- 7-8. RLS
ALTER TABLE public.branch_default_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_default_teachers FORCE ROW LEVEL SECURITY;
CREATE POLICY "Owner full access on branch_default_teachers" ON public.branch_default_teachers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.role_enum)) WITH CHECK (private.has_role(auth.uid(),'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped write on branch_default_teachers" ON public.branch_default_teachers FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(),'admin'::public.role_enum,branch_id)) WITH CHECK (private.has_branch_role(auth.uid(),'admin'::public.role_enum,branch_id));
CREATE POLICY "Authenticated read on branch_default_teachers" ON public.branch_default_teachers FOR SELECT TO authenticated USING (true);
ALTER TABLE public.teacher_attribution_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attribution_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY "Owner full access on teacher_attribution_periods" ON public.teacher_attribution_periods FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.role_enum)) WITH CHECK (private.has_role(auth.uid(),'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped write on teacher_attribution_periods" ON public.teacher_attribution_periods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scheduled_classes sc WHERE sc.id=scheduled_class_id AND private.has_branch_role(auth.uid(),'admin'::public.role_enum,sc.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scheduled_classes sc WHERE sc.id=scheduled_class_id AND private.has_branch_role(auth.uid(),'admin'::public.role_enum,sc.branch_id)));
CREATE POLICY "Authenticated read on teacher_attribution_periods" ON public.teacher_attribution_periods FOR SELECT TO authenticated USING (true);

-- 9. Grants
REVOKE INSERT, UPDATE, DELETE ON public.branch_default_teachers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_attribution_periods FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_default_teachers TO authenticated;
GRANT SELECT ON public.teacher_attribution_periods TO authenticated;

-- 10. Baseline backfill: truthful snapshot at migration time
INSERT INTO public.teacher_attribution_periods (scheduled_class_id, teacher_id, effective_from)
SELECT sc.id, sc.default_teacher_id, sc.created_at
FROM public.scheduled_classes sc WHERE sc.default_teacher_id IS NOT NULL;

COMMIT;
