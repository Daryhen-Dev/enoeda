-- Monthly class groups with assigned student rosters (T2)
--
-- Capabilities realized:
--   - No schedule restrictions: scheduled_classes_no_overlap and
--     one_time_classes_no_overlap are dropped and
--     revoke_teacher_with_reassignment loses its teacher-conflict scan, so
--     classes may overlap and a teacher may teach two classes at the same
--     time. The no_default_teacher and revoked_is_default blocks remain.
--   - class_series becomes the monthly group: discipline, default teacher,
--     period month (first day of a month), clone lineage (cloned into the
--     next month only once), is_active and updated_at.
--   - scheduled_classes.series_id becomes NOT NULL and references the group's
--     (id, branch_id, discipline_id), so every weekday row matches its
--     group's branch and discipline (cascade delete with the group).
--   - student_disciplines.billing_mode ('monthly' | 'per_class') marks
--     per-class students, who never belong to a roster. The billing mode is
--     set per enrollment; switching an enrollment to per_class is paired at
--     application level with removal from current/future rosters of that
--     discipline (T8). discipline_events gains the 'billing_mode_changed'
--     event type and the 'monthly'/'per_class' reason values so the change
--     is auditable.
--   - class_payments gains one_time_class_id (at most one occurrence set),
--     with partial unique indexes preventing double charging a per-class
--     student for the same occurrence (T6).
--   - Roster tables class_series_students / one_time_class_students with
--     eligibility triggers (same branch as the class, active student, active
--     monthly-billed enrollment in the class discipline) and branch-scoped
--     RLS mirroring the class_series policies.
--
-- No backfill: all class/student/payment rows were wiped beforehand
-- (scripts/wipe-class-student-test-data.sql), so NOT NULL additions and the
-- composite FK are safe on empty tables.

BEGIN;

-- =============================================================================
-- 1. Drop schedule restrictions
-- =============================================================================

ALTER TABLE public.scheduled_classes DROP CONSTRAINT scheduled_classes_no_overlap;
ALTER TABLE public.one_time_classes DROP CONSTRAINT one_time_classes_no_overlap;

CREATE OR REPLACE FUNCTION public.revoke_teacher_with_reassignment(
  p_target_user_id uuid, p_branch_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_repl uuid; v_cut timestamptz:=now(); v_n int:=0;
BEGIN
  IF NOT (private.has_role(auth.uid(),'owner'::public.role_enum)
    OR private.has_branch_role(auth.uid(),'admin'::public.role_enum,p_branch_id)) THEN
    RAISE EXCEPTION 'unauthorized: insufficient privileges to revoke teacher';
  END IF;
  SELECT bdt.teacher_id INTO v_repl FROM public.branch_default_teachers bdt WHERE bdt.branch_id=p_branch_id;
  IF v_repl IS NULL THEN RETURN jsonb_build_object('status','blocked','reason','no_default_teacher'); END IF;
  IF v_repl=p_target_user_id THEN RETURN jsonb_build_object('status','blocked','reason','revoked_is_default'); END IF;
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

-- =============================================================================
-- 2. class_series becomes the monthly group
-- =============================================================================

ALTER TABLE public.class_series
  ADD COLUMN discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  ADD COLUMN default_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN period_month date NOT NULL,
  ADD COLUMN cloned_from_series_id uuid REFERENCES public.class_series(id) ON DELETE SET NULL,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT class_series_period_month_start_of_month_ck
    CHECK (period_month = date_trunc('month', period_month)::date),
  ADD CONSTRAINT class_series_id_branch_discipline_uq
    UNIQUE (id, branch_id, discipline_id);

-- A group is cloned into the next month only once
CREATE UNIQUE INDEX class_series_cloned_from_series_id_uq
  ON public.class_series (cloned_from_series_id)
  WHERE cloned_from_series_id IS NOT NULL;

CREATE INDEX class_series_branch_period_month_idx
  ON public.class_series (branch_id, period_month);

CREATE INDEX class_series_discipline_id_idx
  ON public.class_series (discipline_id);

CREATE TRIGGER class_series_updated_at
  BEFORE UPDATE ON public.class_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. scheduled_classes: every weekday row matches its group's branch and
--    discipline (composite FK over the group's identity)
-- =============================================================================

ALTER TABLE public.scheduled_classes
  DROP CONSTRAINT scheduled_classes_series_id_fkey,
  ALTER COLUMN series_id SET NOT NULL,
  ADD CONSTRAINT scheduled_classes_series_id_fkey
    FOREIGN KEY (series_id, branch_id, discipline_id)
    REFERENCES public.class_series (id, branch_id, discipline_id)
    ON DELETE CASCADE;

-- =============================================================================
-- 4. Billing mode per enrollment
-- =============================================================================

ALTER TABLE public.student_disciplines
  ADD COLUMN billing_mode text NOT NULL DEFAULT 'monthly',
  ADD CONSTRAINT student_disciplines_billing_mode_ck
    CHECK (billing_mode IN ('monthly','per_class'));

-- Billing-mode changes are audited on discipline_events with the new mode as
-- the reason, so both closed value lists gain the new values.
ALTER TABLE public.discipline_events
  DROP CONSTRAINT discipline_events_type_ck,
  ADD CONSTRAINT discipline_events_type_ck
    CHECK (event_type IN ('enrolled','suspended','reactivated','billing_mode_changed'));

ALTER TABLE public.discipline_events
  DROP CONSTRAINT discipline_events_reason_ck,
  ADD CONSTRAINT discipline_events_reason_ck
    CHECK (reason IS NULL OR reason IN ('non_payment', 'manual', 'monthly', 'per_class'));

-- =============================================================================
-- 5. Roster tables
-- =============================================================================

CREATE TABLE public.class_series_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id  uuid NOT NULL REFERENCES public.class_series(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  added_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_series_students_series_student_uq UNIQUE (series_id, student_id)
);
CREATE INDEX class_series_students_student_id_idx
  ON public.class_series_students (student_id);

CREATE TABLE public.one_time_class_students (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  one_time_class_id uuid NOT NULL REFERENCES public.one_time_classes(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  added_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_time_class_students_class_student_uq UNIQUE (one_time_class_id, student_id)
);
CREATE INDEX one_time_class_students_student_id_idx
  ON public.one_time_class_students (student_id);

COMMENT ON TABLE public.class_series_students IS
  'Students assigned to a monthly class group (class_series roster)';
COMMENT ON TABLE public.one_time_class_students IS
  'Students assigned to a one-time class roster';

-- -----------------------------------------------------------------------------
-- 5a. Branch helpers for RLS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.class_series_branch_id(p_series_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT branch_id FROM public.class_series WHERE id = p_series_id;
$$;
REVOKE EXECUTE ON FUNCTION private.class_series_branch_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.class_series_branch_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.one_time_class_branch_id(p_one_time_class_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT branch_id FROM public.one_time_classes WHERE id = p_one_time_class_id;
$$;
REVOKE EXECUTE ON FUNCTION private.one_time_class_branch_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.one_time_class_branch_id(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5b. Eligibility: same branch, active student, active monthly enrollment
--     in the class discipline. Raises with stable message prefixes so the
--     application can map each failure to a user-facing error.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.assert_roster_eligibility(
  p_branch_id uuid, p_discipline_id uuid, p_student_id uuid
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_branch_id uuid; v_is_active boolean;
BEGIN
  SELECT branch_id, is_active INTO v_branch_id, v_is_active
  FROM public.students WHERE id = p_student_id;
  IF v_branch_id IS NULL OR v_branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'roster_student_branch_mismatch: student % does not belong to branch %', p_student_id, p_branch_id;
  END IF;
  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'roster_student_inactive: student % is not active', p_student_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_disciplines sd
    WHERE sd.student_id = p_student_id
      AND sd.discipline_id = p_discipline_id
      AND sd.is_active = true
      AND sd.billing_mode = 'monthly'
  ) THEN
    RAISE EXCEPTION 'roster_student_not_eligible: student % has no active monthly enrollment in discipline %', p_student_id, p_discipline_id;
  END IF;
END;$$;
REVOKE EXECUTE ON FUNCTION private.assert_roster_eligibility(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.assert_roster_eligibility(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.class_series_students_eligibility()
RETURNS trigger
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_branch_id uuid; v_discipline_id uuid;
BEGIN
  SELECT branch_id, discipline_id INTO v_branch_id, v_discipline_id
  FROM public.class_series WHERE id = NEW.series_id;
  PERFORM private.assert_roster_eligibility(v_branch_id, v_discipline_id, NEW.student_id);
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION private.one_time_class_students_eligibility()
RETURNS trigger
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_branch_id uuid; v_discipline_id uuid;
BEGIN
  SELECT branch_id, discipline_id INTO v_branch_id, v_discipline_id
  FROM public.one_time_classes WHERE id = NEW.one_time_class_id;
  PERFORM private.assert_roster_eligibility(v_branch_id, v_discipline_id, NEW.student_id);
  RETURN NEW;
END;$$;

CREATE TRIGGER class_series_students_eligibility
  BEFORE INSERT OR UPDATE ON public.class_series_students
  FOR EACH ROW EXECUTE FUNCTION private.class_series_students_eligibility();

CREATE TRIGGER one_time_class_students_eligibility
  BEFORE INSERT OR UPDATE ON public.one_time_class_students
  FOR EACH ROW EXECUTE FUNCTION private.one_time_class_students_eligibility();

-- -----------------------------------------------------------------------------
-- 5c. RLS: mirrors the class_series policies, branch resolved via helpers
-- -----------------------------------------------------------------------------

ALTER TABLE public.class_series_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_series_students FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on class_series_students"
  ON public.class_series_students FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on class_series_students"
  ON public.class_series_students FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.class_series_branch_id(series_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.class_series_branch_id(series_id)));

CREATE POLICY "Admin global read on class_series_students"
  ON public.class_series_students FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on class_series_students"
  ON public.class_series_students FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
    private.class_series_branch_id(series_id)));

REVOKE INSERT, UPDATE, DELETE ON public.class_series_students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_series_students TO authenticated;

ALTER TABLE public.one_time_class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_time_class_students FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on one_time_class_students"
  ON public.one_time_class_students FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on one_time_class_students"
  ON public.one_time_class_students FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.one_time_class_branch_id(one_time_class_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.one_time_class_branch_id(one_time_class_id)));

CREATE POLICY "Admin global read on one_time_class_students"
  ON public.one_time_class_students FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on one_time_class_students"
  ON public.one_time_class_students FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
    private.one_time_class_branch_id(one_time_class_id)));

REVOKE INSERT, UPDATE, DELETE ON public.one_time_class_students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.one_time_class_students TO authenticated;

-- =============================================================================
-- 6. class_payments: per-class payments can bind to a one-time class
--    occurrence, and a student can be charged at most once per occurrence
-- =============================================================================

ALTER TABLE public.class_payments
  ADD COLUMN one_time_class_id uuid REFERENCES public.one_time_classes(id) ON DELETE SET NULL,
  ADD CONSTRAINT class_payments_single_occurrence_ck
    CHECK (scheduled_class_id IS NULL OR one_time_class_id IS NULL);

CREATE INDEX class_payments_one_time_class_id_idx
  ON public.class_payments (one_time_class_id);

-- Prevent double charging: at most one class payment per student,
-- occurrence and class date.
CREATE UNIQUE INDEX class_payments_scheduled_occurrence_uq
  ON public.class_payments (student_discipline_id, scheduled_class_id, class_date)
  WHERE scheduled_class_id IS NOT NULL;

CREATE UNIQUE INDEX class_payments_one_time_occurrence_uq
  ON public.class_payments (student_discipline_id, one_time_class_id)
  WHERE one_time_class_id IS NOT NULL;

-- =============================================================================
-- 7. class_guests: trial-class guests (T7)
--    A guest is a NEW person (not in the system) who attends a trial class.
--    Guests are bound to one class occurrence (scheduled_class_id XOR
--    one_time_class_id) and can later be converted into a student
--    (converted_student_id). No national id / email / birth date.
-- =============================================================================

CREATE TABLE public.class_guests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  scheduled_class_id   uuid REFERENCES public.scheduled_classes(id) ON DELETE CASCADE,
  one_time_class_id    uuid REFERENCES public.one_time_classes(id) ON DELETE CASCADE,
  session_date         date NOT NULL,
  first_name           text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  surname              text NOT NULL CHECK (char_length(surname) BETWEEN 1 AND 100),
  phone                text CHECK (phone IS NULL OR char_length(phone) <= 30),
  observation          text CHECK (observation IS NULL OR char_length(observation) <= 500),
  converted_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_guests_single_class_ck CHECK (
    (scheduled_class_id IS NOT NULL AND one_time_class_id IS NULL)
    OR
    (scheduled_class_id IS NULL AND one_time_class_id IS NOT NULL)
  )
);

CREATE INDEX class_guests_scheduled_class_session_idx
  ON public.class_guests (scheduled_class_id, session_date);
CREATE INDEX class_guests_one_time_class_id_idx
  ON public.class_guests (one_time_class_id);
CREATE INDEX class_guests_branch_id_idx
  ON public.class_guests (branch_id);
CREATE INDEX class_guests_converted_student_id_idx
  ON public.class_guests (converted_student_id);

CREATE TRIGGER class_guests_updated_at
  BEFORE UPDATE ON public.class_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A guest must belong to the same branch as its class occurrence.
CREATE OR REPLACE FUNCTION private.assert_class_guest_branch()
RETURNS trigger
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_class_branch_id uuid;
BEGIN
  SELECT branch_id INTO v_class_branch_id
  FROM public.scheduled_classes WHERE id = NEW.scheduled_class_id;
  IF v_class_branch_id IS NULL THEN
    SELECT branch_id INTO v_class_branch_id
    FROM public.one_time_classes WHERE id = NEW.one_time_class_id;
  END IF;
  IF v_class_branch_id IS NULL OR v_class_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'class_guest_branch_mismatch';
  END IF;
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION private.assert_class_guest_branch() FROM public;
GRANT EXECUTE ON FUNCTION private.assert_class_guest_branch() TO authenticated;

CREATE TRIGGER class_guests_branch_mismatch
  BEFORE INSERT OR UPDATE ON public.class_guests
  FOR EACH ROW EXECUTE FUNCTION private.assert_class_guest_branch();

ALTER TABLE public.class_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_guests FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on class_guests"
  ON public.class_guests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on class_guests"
  ON public.class_guests FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    branch_id));

CREATE POLICY "Admin global read on class_guests"
  ON public.class_guests FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on class_guests"
  ON public.class_guests FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
    branch_id));

-- Teachers may add a guest only to a class occurrence they actually teach
-- (reuses the shared attendance helper covering both class kinds).
CREATE POLICY "Teacher assigned-class insert on class_guests"
  ON public.class_guests FOR INSERT TO authenticated
  WITH CHECK (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id)
    AND private.attendance_is_teacher(auth.uid(), scheduled_class_id, one_time_class_id, session_date)
  );

-- The teacher who added a guest may remove it (the capture window is
-- enforced at application level, like attendance capture).
CREATE POLICY "Teacher creator delete on class_guests"
  ON public.class_guests FOR DELETE TO authenticated
  USING (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id)
    AND created_by = auth.uid()
  );

-- Teachers of the branch may link a guest to the student created from it
-- ("Convertir en alumno"); the branch trigger keeps branch_id consistent.
CREATE POLICY "Teacher branch-scoped update on class_guests"
  ON public.class_guests FOR UPDATE TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

REVOKE INSERT, UPDATE, DELETE ON public.class_guests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_guests TO authenticated;

COMMENT ON TABLE public.class_guests IS
  'Trial-class guests: new people added to a class occurrence before becoming students';

COMMIT;
