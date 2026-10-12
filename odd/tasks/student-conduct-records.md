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
- [ ] T1: Migration: student_conduct_records table (kind fine|warning,
      reason, amount for fines only, status, paid_at/paid_by,
      voided_at/voided_by/void_reason, created_by), CHECKs, RLS, column
      grants, migration test; Prisma model.
- [ ] T2: Domain: lib/domain/conduct (zod schema, create, mark fine paid,
      void, staff list query, student self query) with tests.
- [ ] T3: UI: "Conducta" tab in student detail (list, register dialog,
      mark paid, void with reason) + read-only section in /student; es-ec
      copy.
- [ ] T4: Apply migration to Supabase (needs user authorization), verify.

## Evidence
