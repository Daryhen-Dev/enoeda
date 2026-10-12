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
- [x] T1: Nullable schema: migration (drop NOT NULL, non-blank CHECKs),
      migration test, Prisma + generated client, database.types; make all
      type ripples and displays null-safe (no behavior change yet).
- [x] T2: Optional creation/edit: zod schemas (blank -> null, clear on
      update), actions, clear duplicate national id / email messages,
      student form optional fields, "Datos incompletos" badge; tests.
- [x] T3: Duplicate name warning: domain lookup (same branch, normalized
      first name + surname) and live non-blocking warning in the form.
- [x] T4: Apply migration to Supabase (user-authorized pattern), verify.

## Evidence
- T1 (delegated: gentle-ai-worker), commit e3c35e0: migration
  20260913000000 (DROP NOT NULL x3, non-blank CHECKs on national_id and
  email, column comments, unique indexes kept) + structural test; Prisma
  + generated client; database.types; null-safe payload types and
  displays with STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED ("No
  registrado"); age omitted in the detail header when no date of birth.
  TDD RED (ENOENT) -> GREEN 6/6; tsc clean; eslint clean; pnpm test 1268
  passed / 1 skipped (lib/prisma/client.test.ts repo-walk timeout is
  load-flaky, pre-existing); pnpm build ok.
- T2 (delegated: gentle-ai-worker), commit 356b1af: schemas (blank ->
  NULL, validated when present, future date of birth rejected, update
  clear to null), NULL writes, mapStudentTransactionError for
  students_national_id_uq / students_email_normalized_uq (message-contains,
  same pattern as disciplines), form with only names required + optional
  hints, getMissingStudentData helper + "Datos incompletos" badge in
  directory and detail header. Public registration untouched. TDD RED 15
  failed -> GREEN 68/68; tsc clean; eslint clean (one pre-existing
  warning in actions.test.ts); pnpm test 1305 passed / 1 skipped; pnpm
  build ok. Note: update does not trim names (create does).
- T3 (delegated: gentle-ai-worker), commit 962ce6c:
  findStudentsWithSameName (same branch, trimmed + collapsed whitespace,
  case-insensitive equals on both names, active and inactive, max 5,
  createStudent authorization parity) and a debounced non-blocking
  warning in the create form (aria-live, links open in a new tab; edit
  mode excluded; lookup errors silent). Not accent-insensitive ("Jose" !=
  "José"; no unaccent extension). TDD RED -> GREEN (19 domain, 10 form);
  tsc clean; eslint clean; pnpm test 1329 passed / 1 skipped; build ok.
- T4: migration 20260913000000 APPLIED to Supabase dboqqtfsywhjqhbpxdbm
  (user-authorized) via `pg` + DATABASE_URL. Precheck: 3 columns NOT
  NULL, 0 blank rows (1 student). Post-check: 3 columns nullable, both
  non-blank CHECKs present. Rolled-back probe as a non-owner branch admin
  (0 probe rows left): two name-only inserts with the same name ok; blank
  national_id -> CHECK; duplicate national_id -> students_national_id_uq;
  upper-cased duplicate email -> students_email_normalized_uq.
  Defect found and fixed (parent): with @prisma/adapter-pg the P2002
  message lists only fields, so the T2 message-contains mapping never
  matched (would show "error inesperado"); live Prisma probe showed the
  name in meta.driverAdapterError.cause.originalMessage. Mapping now reads
  it; test mock uses the real shape. RED 2 failed -> GREEN 119/119
  students; verified (gentle-ai-verify): tsc clean, pnpm test 1329 passed
  / 1 skipped, build ok; eslint only the pre-existing actions.test.ts
  no-unsafe-function-type error (also on main).
- Follow-up (not in scope): lib/domain/disciplines/actions.ts (name/code
  uq, student_disciplines_pair_uq) and lib/domain/classes/actions.ts
  (class_series_cloned_from_series_id_uq) use the same message-contains
  pattern and are likely affected by the same adapter behavior.
