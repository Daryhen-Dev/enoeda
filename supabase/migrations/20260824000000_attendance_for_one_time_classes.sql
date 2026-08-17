-- Extend attendance to also cover one_time_classes (recovery/makeup
-- classes held on a single date, e.g. to compensate for a holiday
-- suspension). Attendance was previously anchored ONLY to
-- (scheduled_class_id, session_date); this makes scheduled_class_id
-- nullable and adds one_time_class_id, with a CHECK enforcing exactly
-- one of the two is set. Recovery-class attendance counts toward the
-- student's attendance stats (same table, same query surface) since a
-- recovery class is still real class time.

BEGIN;

-- 1. Add one_time_class_id, make scheduled_class_id nullable, enforce XOR
ALTER TABLE public.attendance
  ADD COLUMN one_time_class_id uuid REFERENCES public.one_time_classes(id) ON DELETE RESTRICT;

ALTER TABLE public.attendance
  ALTER COLUMN scheduled_class_id DROP NOT NULL;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_class_ref_ck CHECK (
    (scheduled_class_id IS NOT NULL AND one_time_class_id IS NULL)
    OR
    (scheduled_class_id IS NULL AND one_time_class_id IS NOT NULL)
  );

-- 2. Replace the single-column unique constraint with two partial unique
--    indexes, one per class kind (a plain unique constraint would treat
--    every NULL as distinct and fail to prevent duplicate one-time rows).
ALTER TABLE public.attendance DROP CONSTRAINT attendance_session_student_uq;

CREATE UNIQUE INDEX attendance_scheduled_session_student_uq
  ON public.attendance (scheduled_class_id, session_date, student_id)
  WHERE scheduled_class_id IS NOT NULL;

CREATE UNIQUE INDEX attendance_one_time_student_uq
  ON public.attendance (one_time_class_id, student_id)
  WHERE one_time_class_id IS NOT NULL;

CREATE INDEX attendance_one_time_class_id_idx ON public.attendance (one_time_class_id);

-- 3. Helpers that resolve branch/teacher/suspension across BOTH class
--    kinds, so RLS policies stay a single expression instead of
--    duplicating per-kind logic inline.
CREATE OR REPLACE FUNCTION private.attendance_branch_id(
  p_scheduled_class_id uuid, p_one_time_class_id uuid
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT branch_id FROM public.scheduled_classes WHERE id = p_scheduled_class_id),
    (SELECT branch_id FROM public.one_time_classes WHERE id = p_one_time_class_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION private.attendance_branch_id(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.attendance_branch_id(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_is_teacher(
  p_user_id uuid, p_scheduled_class_id uuid, p_one_time_class_id uuid, p_session_date date
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_scheduled_class_id IS NOT NULL THEN
      private.is_session_teacher(p_user_id, p_scheduled_class_id, p_session_date)
    ELSE
      EXISTS (
        SELECT 1 FROM public.one_time_classes
        WHERE id = p_one_time_class_id AND teacher_id = p_user_id
      )
  END;
$$;
REVOKE EXECUTE ON FUNCTION private.attendance_is_teacher(uuid, uuid, uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION private.attendance_is_teacher(uuid, uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_is_suspended(
  p_scheduled_class_id uuid, p_session_date date
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  -- Suspension only exists as a concept for recurring classes
  -- (class_sessions overrides). One-time classes have no such state.
  SELECT p_scheduled_class_id IS NOT NULL
    AND private.is_session_suspended(p_scheduled_class_id, p_session_date);
$$;
REVOKE EXECUTE ON FUNCTION private.attendance_is_suspended(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION private.attendance_is_suspended(uuid, date) TO authenticated;

-- 4. Replace the two write policies that referenced scheduled_class_id
--    directly with versions using the combined helpers above. The
--    owner read-only policy is unaffected (no class-kind reference).
DROP POLICY "Admin branch-scoped write on attendance" ON public.attendance;
DROP POLICY "Teacher assigned-class write on attendance" ON public.attendance;

CREATE POLICY "Admin branch-scoped write on attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.attendance_branch_id(scheduled_class_id, one_time_class_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.attendance_branch_id(scheduled_class_id, one_time_class_id))
    AND NOT private.attendance_is_suspended(scheduled_class_id, session_date));

CREATE POLICY "Teacher assigned-class write on attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
      private.attendance_branch_id(scheduled_class_id, one_time_class_id))
    AND private.attendance_is_teacher(auth.uid(), scheduled_class_id, one_time_class_id, session_date)
  )
  WITH CHECK (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
      private.attendance_branch_id(scheduled_class_id, one_time_class_id))
    AND private.attendance_is_teacher(auth.uid(), scheduled_class_id, one_time_class_id, session_date)
    AND NOT private.attendance_is_suspended(scheduled_class_id, session_date)
  );

COMMIT;
