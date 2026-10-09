-- One-off wipe of disposable test data before the monthly class rosters
-- redesign (odd/tasks/monthly-class-rosters.md, T1).
--
-- Deletes: classes (recurring, series, one-time), sessions, teacher
-- attribution periods, attendance, monthly and per-class payments, payment
-- audit entries, students, enrollments, enrollment events, progress, notes,
-- and the auth accounts that belong ONLY to students.
--
-- Preserves: branches, disciplines, levels, branch level requirements,
-- branch default teachers, staff/owner accounts (user_roles), user_profiles
-- of staff, registration rate-limit/nonce tables.
--
-- NOT a migration on purpose: data deletion must not live in the migration
-- history. Run once, manually, against the test database. Irreversible.

BEGIN;

-- Capture student auth accounts before their student rows are deleted.
-- Any account that also holds a staff role is excluded (never deleted).
CREATE TEMP TABLE wipe_student_auth_users ON COMMIT DROP AS
SELECT DISTINCT s.auth_user_id AS user_id
FROM public.students s
WHERE s.auth_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = s.auth_user_id
  );

-- Preview of what will be removed.
SELECT 'class_payments' AS table_name, count(*) FROM public.class_payments
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'attendance', count(*) FROM public.attendance
UNION ALL SELECT 'class_sessions', count(*) FROM public.class_sessions
UNION ALL SELECT 'scheduled_classes', count(*) FROM public.scheduled_classes
UNION ALL SELECT 'class_series', count(*) FROM public.class_series
UNION ALL SELECT 'one_time_classes', count(*) FROM public.one_time_classes
UNION ALL SELECT 'students', count(*) FROM public.students
UNION ALL SELECT 'student_disciplines', count(*) FROM public.student_disciplines
UNION ALL SELECT 'student auth users', count(*) FROM wipe_student_auth_users;

-- Payments first: their BEFORE DELETE trigger writes audit entries, which
-- are removed right after.
DELETE FROM public.class_payments;
DELETE FROM public.payments;
DELETE FROM public.payment_audit_entries;

DELETE FROM public.attendance;
DELETE FROM public.class_sessions;
DELETE FROM public.teacher_attribution_periods;
DELETE FROM public.scheduled_classes;
DELETE FROM public.class_series;
DELETE FROM public.one_time_classes;

-- Cascades to student_disciplines, discipline_events, student_progress,
-- student_notes.
DELETE FROM public.students;

-- Student-only auth accounts (cascades to their user_profiles row).
DELETE FROM auth.users u
USING wipe_student_auth_users w
WHERE u.id = w.user_id;

-- Post-check: every listed table must be empty.
SELECT 'remaining rows' AS check_name,
  (SELECT count(*) FROM public.class_payments)
  + (SELECT count(*) FROM public.payments)
  + (SELECT count(*) FROM public.attendance)
  + (SELECT count(*) FROM public.class_sessions)
  + (SELECT count(*) FROM public.scheduled_classes)
  + (SELECT count(*) FROM public.class_series)
  + (SELECT count(*) FROM public.one_time_classes)
  + (SELECT count(*) FROM public.students)
  + (SELECT count(*) FROM public.student_disciplines) AS total;

COMMIT;
