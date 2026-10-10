-- 20260911000000_class_series_teacher.sql
-- Group-wide teacher change for a monthly class group (class_series).
--
-- public.set_class_series_teacher(p_series_id, p_teacher_id):
--   - Validates caller (owner or branch admin) and, when a teacher is given,
--     that the teacher holds an active teacher role in the series branch.
--   - Applies the change from now (cutoff = now()): every ACTIVE weekday row
--     of the series gets its attribution history closed at the cutoff and a
--     new period opened for the new teacher. Weekday rows created after
--     20260828000000 (every monthly group) have no periods at all: for
--     those, a baseline period (old default teacher, effective from
--     -infinity) keeps past occurrences attributed to the previous teacher.
--     -infinity rather than the row's created_at because a group created
--     mid-month still renders earlier occurrences of that month. Without the
--     baseline, resolve_effective_teacher would fall back to
--     scheduled_classes.default_teacher_id, i.e. the NEW teacher (or NULL).
--   - Day substitutions (class_sessions.assigned_teacher_id) are left
--     untouched.
-- Timezone: America/Guayaquil (UTC-5), same as 20260828000000.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_class_series_teacher(
  p_series_id uuid, p_teacher_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_branch_id uuid;
  v_row record;
  v_cut timestamptz:=now();
  v_n int:=0;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.class_series WHERE id=p_series_id;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'class_series_not_found';
  END IF;
  IF NOT (private.has_role(auth.uid(),'owner'::public.role_enum)
    OR private.has_branch_role(auth.uid(),'admin'::public.role_enum,v_branch_id)) THEN
    RAISE EXCEPTION 'unauthorized: insufficient privileges';
  END IF;
  IF p_teacher_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id=p_teacher_id AND role='teacher'::public.role_enum
        AND branch_id=v_branch_id AND revoked_at IS NULL) THEN
      RAISE EXCEPTION 'invalid_teacher: teacher must have an active teacher role in this branch';
    END IF;
  END IF;
  FOR v_row IN
    SELECT id, default_teacher_id
    FROM public.scheduled_classes
    WHERE series_id=p_series_id AND is_active=true
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.teacher_attribution_periods tap
      WHERE tap.scheduled_class_id=v_row.id) THEN
      IF v_row.default_teacher_id IS NOT NULL THEN
        INSERT INTO public.teacher_attribution_periods (scheduled_class_id, teacher_id, effective_from, effective_until)
        VALUES (v_row.id, v_row.default_teacher_id, '-infinity'::timestamptz, v_cut);
      END IF;
    ELSE
      UPDATE public.teacher_attribution_periods SET effective_until=v_cut
      WHERE scheduled_class_id=v_row.id AND effective_until IS NULL;
    END IF;
    IF p_teacher_id IS NOT NULL THEN
      INSERT INTO public.teacher_attribution_periods (scheduled_class_id, teacher_id, effective_from)
      VALUES (v_row.id, p_teacher_id, v_cut);
    END IF;
  END LOOP;
  UPDATE public.scheduled_classes SET default_teacher_id=p_teacher_id
  WHERE series_id=p_series_id AND is_active=true;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  UPDATE public.class_series SET default_teacher_id=p_teacher_id
  WHERE id=p_series_id;
  RETURN jsonb_build_object('updatedClassCount', v_n, 'cutoff', v_cut);
END;$$;
REVOKE EXECUTE ON FUNCTION public.set_class_series_teacher(uuid, uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_class_series_teacher(uuid, uuid) TO authenticated;

COMMIT;
