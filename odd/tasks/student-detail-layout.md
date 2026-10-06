# Student detail page reorganization

User problem: the student summary page (`app/dashboard/students/[id]/page.tsx`)
shows too much information without clear organization.

## Findings (read-only analysis)
- Single flex column of 7 same-weight sections ordered by data type
  (disciplines, attendance, progress, notes, payments, enrollment history);
  the discipline name repeats across ~5 panels.
- Per-discipline actions are detached from their discipline: with N active
  enrollments the page renders 2N payment buttons and 2N promotion buttons
  whose labels never name the discipline (risk of charging the wrong one).
- Unbounded lists (payments table, notes grid, promotions, enrollment events).
- Header hides `is_active`, `date_of_birth`, `national_id` already returned by
  `getStudentById`.

## Decisions (user-confirmed)
- Layout: who they are -> how they are doing now -> what happened before.
- Primary job: view the student record, then register the monthly payment.
  "Registrar pago mensual" is the primary action of each discipline card.
- Teachers mainly use the notes log (bitacora): default history tab is
  Bitacora when the viewer cannot manage, Pagos when they can.
- Refinement of the incumbent visual system (no redesign).

## Tasks
- [x] T1: Header: active/inactive badge, age from date_of_birth, national_id,
      email, phone.
- [x] T2: One card per enrollment grouping status, level/progress summary,
      attendance, last monthly payment ("pagado hasta"), and its actions
      (primary: Registrar pago mensual; secondary: Cobrar clase, Promover;
      overflow menu: Corregir ultima promocion, Suspender/Reactivar).
      Discipline-scoped accessible labels on every action.
- [x] T3: History tabs (Bitacora, Pagos, Progreso, Inscripciones) with
      role-based default tab and bounded lists (latest N + "Ver todo").
- [x] T4: Tests for the derivation helpers and the new composition; tsc,
      full vitest, scoped eslint.
- [x] T5: Work-unit commit.

## Evidence
- Worker: gentle-ai-worker (+ one continuation for the age timezone fix).
- New: student-detail-header.tsx, student-discipline-card.tsx (+ test),
  student-history-tabs.tsx, lib/domain/students/detail-summary.ts (+ test).
- Per-discipline cards group level/attendance/"Pagado hasta"/actions;
  primary action "Registrar pago mensual"; Promover secondary; Corregir
  ultima promocion + Suspender/Reactivar in an overflow menu (controlled
  dialog props, additive and optional). Every per-discipline action has a
  discipline-scoped accessible name.
- History tabs: Bitacora / Pagos / Progreso / Inscripciones with counts;
  default "payments" when canManage, "notes" otherwise; lists bounded to the
  latest 10 with "Ver todo (N)".
- Parent review fix: age now uses the branch-local date
  (getCurrentDateOnly(branchResult.timeZone)) instead of the UTC date, which
  counted Ecuador birthdays one day early after 19:00 local time; regression
  test added.
- Checks: pnpm exec tsc --noEmit clean; pnpm vitest run 792 passed / 1
  skipped / 0 failed; eslint clean on all changed/new files.
- Not verified: no browser visual check (mobile tab list overflow, xl 2-column
  grid, overflow menu keyboard access, dialog portals inside tab content).
- Known limitation: monthly payments are matched to disciplines by name
  (PaymentRecord has no discipline id).
- Commit: feat(students): reorganize the student detail page around disciplines (branch feat/student-detail-layout; hash reported by git log after amend)
