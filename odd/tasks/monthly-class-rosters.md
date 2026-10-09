# Monthly class groups with assigned student rosters

User request: classes stop being implicitly open to every student enrolled in
the discipline. The admin builds monthly class groups and assigns the students
who may attend, like a school. Groups are cloned into the next month with
their roster.

## Findings
- Today the attendance roster is implicit: every active student of the branch
  enrolled in the discipline (`student_disciplines`), see
  `lib/domain/attendance/actions.ts`.
- `class_series` already groups several weekday `scheduled_classes` rows.
- `scheduled_classes_no_overlap` (EXCLUDE per branch/weekday/1h) blocks
  simultaneous classes; `detectTeacherConflicts` blocks teacher overlaps.
- Overdue status derives from `student_disciplines.next_due_date`;
  per-class payments already exist in `class_payments`.
- Target database: Supabase project `dboqqtfsywhjqhbpxdbm`.

## Decisions (user-confirmed)
- No schedule restrictions: classes may overlap, and a teacher may teach two
  classes at the same time (drop overlap constraint and teacher conflict checks).
- Monthly group = `class_series` with discipline, teacher, month, several
  weekdays/times; sessions only render inside its month.
- One-time classes keep a required discipline and get their own roster.
- Roster eligibility: active student, enrolled and active in that discipline,
  monthly billing mode.
- Clone to next month copies days, times, teacher and roster; ineligible
  students are skipped and reported; the admin edits the roster afterwards.
- Billing mode per enrollment (`monthly` | `per_class`). Per-class students are
  never overdue, are not in rosters, and can join any class of their
  discipline; marking them present asks for the class payment inline.
- Guests (trial class): new people not in the system, stored in a separate
  guest table bound to the class occurrence (name, phone, observation), with
  a "Convertir en alumno" action that prefills student creation.
- Teachers and admins can add per-class students and guests to a session.
- Existing classes, sessions, attendance, payments, students and enrollments
  are disposable test data and will be wiped (user-authorized in principle;
  the exact script is confirmed before execution).
- Workflow: ODD.

## Tasks
- [x] T1: Wipe script for class/student test data (preserve staff accounts,
      branches, disciplines, levels); user confirms, then run on Supabase.
- [x] T2: Migration: drop `scheduled_classes_no_overlap`; `class_series` gains
      discipline, default teacher, month; roster tables for series and
      one-time classes; `student_disciplines.billing_mode`; RLS; Prisma sync.
- [ ] T3: Domain: remove teacher conflict detection; create monthly group
      (series + weekdays); calendar renders sessions only inside the month.
- [ ] T4: Roster actions (add/remove/list) for series and one-time classes
      with eligibility rules.
- [ ] T5: Clone group to next month with roster and skipped-students report.
- [ ] T6: Attendance reads the assigned roster; teacher/admin add per-class
      students to a session with inline class payment.
- [ ] T7: Guests: guest table, add guest in attendance, convert to student.
- [ ] T8: Billing mode: set at enrollment, per-class excluded from overdue.
- [ ] T9: Admin UI: monthly group create dialog, roster editor, clone action.

## Evidence
- T1: `scripts/wipe-class-student-test-data.sql` (single transaction, not a
  migration). Read-only preview, then user-confirmed run on Supabase
  `dboqqtfsywhjqhbpxdbm` via `pg` + DATABASE_URL. Removed 6 scheduled
  classes, 3 series, 1 one-time class, 2 sessions, 3 attendance, 2 monthly
  payments, 3 students (+3 enrollments, 5 events, 7 progress, 2 notes).
  0 student-only auth accounts existed. Post-check: all target tables 0 rows;
  4 active staff accounts preserved. `student_invitations` was already
  dropped by 20260904000000, so it is not referenced.
- T2 (delegated: gentle-ai-worker): migration 20260910000000_monthly_class_rosters
  (drop scheduled_classes_no_overlap; revoke_teacher_with_reassignment without
  conflict scan; class_series monthly fields, start-of-month CHECK, clone-once
  partial unique, composite FK from scheduled_classes; billing_mode CHECK;
  class_series_students / one_time_class_students with eligibility triggers
  and branch-scoped RLS). Structural test RED (ENOENT) -> GREEN 10/10. Prisma
  schema synced and client regenerated (new model files force-added). Full
  vitest 906 passed / 1 skipped. tsc: 5 expected errors in
  lib/domain/classes/actions.ts, resolved in T3. Migration NOT applied yet.
  Known gap for T8: deactivating an enrollment or switching it to per_class
  does not remove existing roster rows; handled at application level.
