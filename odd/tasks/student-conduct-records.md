# Student conduct records (fines and warnings)

User request: register fines ("multas") and warnings ("llamados de
atención") for a student.

Branch: feat/student-conduct-records, from main.

## Findings
- No existing fine/warning concept. student_notes (bitácora) has a CHECK on
  category ('tecnica','fisico','actitud','medica','general') and no amount,
  status, or void semantics, so it is not reused.
- Branch-scoped RLS helpers exist: private.has_role,
  private.has_branch_role, private.student_branch_id.
- Student detail page uses StudentHistoryTabs with server-rendered slots.
- Student portal: app/student/page.tsx resolves getStudentIdentity().

## Decisions (user)
- Fine = amount with status pending/paid; marked paid manually (date, who).
  Not integrated into monthly payment validation.
- Admin and teacher, both branch-scoped, can register fines and warnings
  (and mark fines paid). Owner read-only, consistent with student_notes.
- Student sees own fines and warnings read-only in /student.
- No edit/delete: records are voided with reason, actor and timestamp.

## Tasks
- [x] T1: Migration: student_conduct_records table (kind fine|warning,
      reason, amount for fines only, status, paid_at/paid_by,
      voided_at/voided_by/void_reason, created_by), CHECKs, RLS, column
      grants, migration test; Prisma model.
- [x] T2: Domain: lib/domain/conduct (zod schema, create, mark fine paid,
      void, staff list query, student self query) with tests.
- [x] T3: UI: "Conducta" tab in student detail (list, register dialog,
      mark paid, void with reason) + read-only section in /student; es-ec
      copy.
- [ ] T4: Apply migration to Supabase (needs user authorization), verify.

## Evidence
- T1 (delegated: gentle-ai-worker), commit 53455f3: migration
  20260912000000 (CHECKs tie amount/status to kind, paid/void
  consistency, guard trigger: identity immutable, void terminal, paid
  terminal, voided cannot be paid; RLS owner read, admin/teacher
  branch-scoped read/insert/update, student self-read; REVOKE ALL then
  SELECT/INSERT + column UPDATE grants; no DELETE). Prisma model +
  generated client (new model file force-added, per a5051e5). TDD RED
  (ENOENT) -> GREEN 20/20; prisma generate ok; tsc clean. Student portal
  reads via Supabase SSR client (RLS), so the self-read policy is
  load-bearing. Correction: the guard rejects paid+voided, so a paid fine
  cannot be voided; the domain layer enforces the same rule.
- T2 (delegated: gentle-ai-worker), commit bb1c1e0: lib/domain/conduct
  (createConductRecord, markFinePaid, voidConductRecord,
  listStudentConductRecords, getOwnConductRecords) + CONDUCT_MESSAGES.
  Branch assertion like notes (owner without branch assignment cannot
  list, same as listNotes). Student view via Supabase SSR client,
  excludes voided. TDD RED 28 failed -> GREEN 45/45; tsc clean; eslint
  clean; pnpm test 1205 passed / 1 skipped.
- T3 (delegated: gentle-ai-worker): "Conducta" tab (StudentConductPanel,
  ConductRecordActions, CreateConductRecordDialog) in student detail;
  read-only "Multas y llamados de atención" section in /student;
  es-EC copy + formatCurrency. Mark paid only for non-voided pending
  fines; void only for non-voided records that are not paid fines.
  TDD RED -> GREEN 15/15 focused; tsc clean; eslint clean; pnpm test
  1218 passed / 1 skipped; pnpm build ok.
