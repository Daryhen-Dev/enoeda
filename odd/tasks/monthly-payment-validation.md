# Monthly payment validation segment

User request: a dedicated admin section to validate, month by month, which
students are active based on their monthly payments, and deactivate the ones
who did not pay. The admin moves between branches through the existing header
switcher (multi-assignment, no code change needed for that).

## Findings
- Overdue state already exists per enrollment: `student_disciplines.next_due_date`
  is recalculated by the DB trigger `private.reconcile_payment_next_due_date`
  using `branches.payment_due_day`. Overdue = `is_active AND next_due_date < today`.
- `suspendEnrollment` (`lib/domain/disciplines/actions.ts`) already suspends one
  enrollment with audit (`suspended_at` + `discipline_events` 'suspended').
- `listOverdueStudents` / `countOverdueStudents` (`lib/domain/payments/queries.ts`)
  compute "today" with server time (`new Date()`), not the branch time zone.
- `branches.payment_due_day` / `payment_edit_window_days` live outside the Prisma
  model and are read/written through raw SQL (`lib/domain/branches/actions.ts`).
- No cron infrastructure exists.

## Decisions (user-confirmed)
- Evaluation is per enrollment (student + discipline); the suspended entity is
  the enrollment, not the whole student.
- Human-in-the-loop: the admin reviews candidates and confirms a bulk
  suspension. No automatic process.
- Candidate = overdue beyond a new per-branch grace period
  (`payment_grace_days`, default 0) after the due date.
- Suspensions record who, when and the reason ("non_payment").
- Bulk suspension is admin-only; individual suspension permissions unchanged.
- Fix the existing overdue queries to use the branch time zone too.
- Delivery: chained PRs to main (stacked-to-main).

## Out of scope
Past-month history, automatic jobs, automatic reactivation on payment.

## Plan
Classification of active enrollments of a branch on the branch-local today:
- `up_to_date`: `next_due_date` is null or >= today.
- `in_grace`: overdue but today <= next_due_date + grace days.
- `to_suspend`: today > next_due_date + grace days.
Plus `suspended_this_month`: enrollments with a 'suspended' event with reason
`non_payment` in the current branch-local month.

## Tasks
- [ ] T1: Migration: `branches.payment_grace_days smallint NOT NULL DEFAULT 0`
      CHECK 0..60; `discipline_events.reason text NULL` CHECK IN
      ('non_payment','manual'). Prisma schema + generated client sync.
      Settings: grace days in schema, get/save actions, settings form.
      Tests (migration text test, settings schema/actions).
- [ ] T2: Branch-time-zone "today" for `countOverdueStudents` /
      `listOverdueStudents` (callers pass the branch-local date). Tests.
- [ ] T3: Domain: pure classifier + `getMonthlyPaymentValidation` (admin of
      branch, branch-local today) + `suspendOverdueEnrollments` (admin only,
      one transaction, re-checks every enrollment is still active, in branch,
      and beyond grace; writes `suspended_at` + 'suspended' event with reason
      'non_payment'). Tests.
- [ ] T4: UI: `/dashboard/payments/validation?branch=` (admin only), grouped
      tables, multi-select on "A suspender", confirmation dialog, link from the
      payments console. es-EC copy.
- [ ] T5: Closure checks: vitest, tsc, eslint, next build. Migration applied to
      Supabase only after explicit user authorization.

## Delivery
- Strategy: ask-on-risk -> chain strategy `stacked-to-main` (user-chosen).
- Forecast: ~900 authored changed lines. Planned slices:
  - PR1: T1 + T2 (migration, settings, time zone fix)
  - PR2: T3 (domain)
  - PR3: T4 (UI)
- TDD: no project/session TDD configuration found; mode off (source: none
  configured). Runner: `pnpm test` (vitest run). Ordinary functional checks.
- RDD: off (clone_local).

## Progress
- Branch `feat/monthly-payment-validation` created from main at 4a2a675.

## Evidence
(pending)

## Next step
T1.
