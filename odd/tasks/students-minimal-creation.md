# Students with minimal data (first name + surname)

User request: create students with only first name and surname; the
complementary data (national id, email, date of birth, phone) is added
later. Warn on create when another student has the same first name and
surname.

Branch: feat/students-minimal-creation, from main (after PR #196).

## Findings (gentle-ai-explore map)
- public.students: national_id, email, date_of_birth are NOT NULL; no DB
  format CHECKs; UNIQUE students_national_id_uq and
  students_email_normalized_uq (lower(email)) stay valid with NULLs.
- No live function depends on those columns; portal linking is by
  auth_user_id only. complete_student_enrollment was dropped (20260904).
- Null-unsafe spots: getAgeInYears (detail header), app/student/page.tsx
  profile, student-form-dialog date formatting, typed payloads
  (StudentProfile, StudentListItem, StudentIdentity, roster/attendance
  candidates, ConductStudentSearchRow).
- createStudent/updateStudent map unique violations to UNEXPECTED_ERROR.
- Public self-registration keeps requiring email (auth user + rate limit).
- Guest -> student conversion reuses student-form-dialog with only names
  and phone: it benefits directly.

## Decisions (user)
- Only first_name and surname required for staff-created students; phone
  stays optional; national id, email, date of birth become optional.
- Warn (non-blocking) on create when a student with the same first name
  AND surname exists in the branch.
- Parent: real NULLs (no placeholder values); "Datos incompletos" badge
  when national id, email or date of birth is missing; blank input stored
  as NULL; public registration unchanged.

## Tasks
- [ ] T1: Nullable schema: migration (drop NOT NULL, non-blank CHECKs),
      migration test, Prisma + generated client, database.types; make all
      type ripples and displays null-safe (no behavior change yet).
- [ ] T2: Optional creation/edit: zod schemas (blank -> null, clear on
      update), actions, clear duplicate national id / email messages,
      student form optional fields, "Datos incompletos" badge; tests.
- [ ] T3: Duplicate name warning: domain lookup (same branch, normalized
      first name + surname) and live non-blocking warning in the form.
- [ ] T4: Apply migration to Supabase (user-authorized pattern), verify.

## Evidence
