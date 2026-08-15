-- 20260818000000_attendance_and_teacher_student_creation.sql
-- Attendance table + RLS + helpers; Teacher INSERT capability on students/student_disciplines (D6).
-- Authority: Supabase SQL migration. Historical migrations (15/16/17) are IMMUTABLE — additions only.
BEGIN;

-- 1. attendance (one row per student per session occurrence) — D1 anchor (scheduled_class_id, session_date)
CREATE TABLE public.attendance (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id  uuid NOT NULL REFERENCES public.scheduled_classes(id) ON DELETE RESTRICT,
  session_date        date NOT NULL,
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attended            boolean NOT NULL,
  observation         text,
  marked_by           uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_session_student_uq UNIQUE (scheduled_class_id, session_date, student_id),
  CONSTRAINT attendance_observation_len_ck CHECK (observation IS NULL OR char_length(observation) <= 500)
);
CREATE INDEX attendance_scheduled_class_id_idx ON public.attendance (scheduled_class_id);
CREATE INDEX attendance_student_id_idx ON public.attendance (student_id);
CREATE INDEX attendance_session_date_idx ON public.attendance (session_date);
CREATE INDEX attendance_class_date_idx ON public.attendance (scheduled_class_id, session_date);
COMMENT ON TABLE public.attendance IS 'Per-student per-session attendance; anchored to (scheduled_class_id, session_date)';

-- 2. updated_at trigger (reuse existing public.set_updated_at)
CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Helper: is the user the teacher assigned to this session? (override wins over default)
CREATE OR REPLACE FUNCTION private.is_session_teacher(
  p_user_id uuid, p_scheduled_class_id uuid, p_session_date date
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scheduled_classes sc
    LEFT JOIN public.class_sessions cs
      ON cs.scheduled_class_id = sc.id AND cs.session_date = p_session_date
    WHERE sc.id = p_scheduled_class_id
      AND ( cs.assigned_teacher_id = p_user_id
         OR (cs.assigned_teacher_id IS NULL AND sc.default_teacher_id = p_user_id) )
  );
$$;
REVOKE EXECUTE ON FUNCTION private.is_session_teacher(uuid, uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION private.is_session_teacher(uuid, uuid, date) TO authenticated;

-- 4. Helper: is this session suspended? (materialized exception with status='suspended')
CREATE OR REPLACE FUNCTION private.is_session_suspended(
  p_scheduled_class_id uuid, p_session_date date
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_sessions cs
    WHERE cs.scheduled_class_id = p_scheduled_class_id
      AND cs.session_date = p_session_date
      AND cs.status = 'suspended'
  );
$$;
REVOKE EXECUTE ON FUNCTION private.is_session_suspended(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION private.is_session_suspended(uuid, date) TO authenticated;

-- 5. RLS: attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;

-- 5a. Owner: global read-only (D5 — infra safety net, not a product write capability)
CREATE POLICY "Owner read-only on attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- 5b. Admin: branch-scoped ALL. Write path additionally blocks suspended sessions (A3).
CREATE POLICY "Admin branch-scoped write on attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.scheduled_class_branch_id(scheduled_class_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.scheduled_class_branch_id(scheduled_class_id))
    AND NOT private.is_session_suspended(scheduled_class_id, session_date));

-- 5c. Teacher: branch-scoped + assigned-session ALL. Write path blocks suspended sessions (A3).
CREATE POLICY "Teacher assigned-class write on attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
      private.scheduled_class_branch_id(scheduled_class_id))
    AND private.is_session_teacher(auth.uid(), scheduled_class_id, session_date)
  )
  WITH CHECK (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
      private.scheduled_class_branch_id(scheduled_class_id))
    AND private.is_session_teacher(auth.uid(), scheduled_class_id, session_date)
    AND NOT private.is_session_suspended(scheduled_class_id, session_date)
  );

-- 6. NEW Teacher INSERT policies (D6) — asymmetric with Admin FOR ALL; INSERT has WITH CHECK only.
CREATE POLICY "Teacher branch-scoped insert on students"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

CREATE POLICY "Teacher branch-scoped insert on student_disciplines"
  ON public.student_disciplines FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
    private.student_branch_id(student_id)));

-- 7. Grants (defense in depth; RLS is the authority)
REVOKE INSERT, UPDATE, DELETE ON public.attendance FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;

COMMIT;
