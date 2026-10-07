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
- [x] T1: Migration: `branches.payment_grace_days smallint NOT NULL DEFAULT 0`
      CHECK 0..60; `discipline_events.reason text NULL` CHECK IN
      ('non_payment','manual'). Prisma schema + generated client sync.
      Settings: grace days in schema, get/save actions, settings form.
      Tests (migration text test, settings schema/actions).
- [x] T2: Branch-time-zone "today" for `countOverdueStudents` /
      `listOverdueStudents` (callers pass the branch-local date). Tests.
- [x] T3: Domain: pure classifier + `getMonthlyPaymentValidation` (admin of
      branch, branch-local today) + `suspendOverdueEnrollments` (admin only,
      one transaction, re-checks every enrollment is still active, in branch,
      and beyond grace; writes `suspended_at` + 'suspended' event with reason
      'non_payment'). Tests.
- [x] T4: UI: `/dashboard/payments/validation?branch=` (admin only), grouped
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
- T1 (delegated: gentle-ai-worker; writer trigger, 2+ non-trivial files):
  migration 20260909000000 (additive, transactional), discipline_events.reason
  in Prisma + regenerated client (4 semantic generated files; 7 LF/CRLF-only
  generated files restored, not committed), settings schema/actions/form/copy.
  Writer: vitest focused 16 passed; tsc clean; eslint clean; pnpm test 823
  passed / 1 skipped. Assess: unassessable (untracked files) -> treated high
  -> independent gentle-ai-verify PASS (same commands green). Parent spot
  check: focused vitest 16 passed. Migration NOT applied to any DB.
  Commit db8def9 feat(payments): add per-branch payment grace days and event
  reason.
- T2 (delegated: gentle-ai-worker): queries resolve branch-local today
  inside the tx (`getBranchLocalToday`, branch `time_zone`, fallback
  America/Guayaquil) and compare `@db.Date` columns with UTC-midnight
  (`dateOnlyToUtcDate`); monthly summary bounds from branch-local month.
  Callers unchanged. Writer: focused vitest 58 passed; tsc/eslint clean;
  pnpm test 834 passed / 1 skipped. Assess: high (payments hot path) ->
  gentle-ai-verify PASS (RLS: admin/teacher/global-admin can SELECT
  branches; time_zone CHECK matches). Residual: no live-DB round trip of
  UTC-midnight date filters. Commit 7cb2c75 fix(payments): evaluate overdue
  and monthly summary on the branch-local date.
- Slice PR1 = db8def9..7cb2c75 (T1+T2), base main 4a2a675. Not pushed.
- T3 (delegated: gentle-ai-worker; first run stalled on a bash call and
  timed out, resumed via subagent_continue from the partial tree): pure
  `lib/domain/payments/validation.ts` (classifier, branch-local month
  bounds), `validation-actions.ts` (`getMonthlyPaymentValidation`,
  `suspendOverdueEnrollments`: admin-only, atomic re-check, guarded
  updateMany + count check -> rollback, events reason non_payment),
  schemas, es-EC copy; `suspendEnrollment` records reason 'manual'.
  RLS: branch-admin FOR ALL on student_disciplines and discipline_events
  (20260816000000); user_profiles readable only by owner of the row, so
  `performed_by_name` is null for other performers (UI must handle).
  Writer: focused vitest 107 passed; tsc/eslint clean; pnpm test 867 passed
  / 1 skipped. Independent gentle-ai-verify: FAIL on one blocker - runtime
  const exports from a "use server" file (Next.js build error once
  imported). Parent fix: made both consts module-private; tsc clean;
  focused vitest 103 passed.
  Follow-ups (accepted, not fixed): redundant branch read for time_zone;
  guarded updateMany re-asserts only enrollment is_active (concurrent
  student deactivation window, low impact); profile lookup swallows all
  errors; notes not trimmed.
- T4 (delegated: gentle-ai-worker): page `/dashboard/payments/validation`
  (admin/canManage only, no global read-only path), 4 metric cards, "A
  suspender" selectable table + confirmation dialog (notes, pending state,
  toast + router.refresh, error in dialog), read-only "En gracia",
  "Suspendidas este mes", "Al día" tables; entry link on payments console
  (canManage). Parent fixes: suspension timestamps formatted in branch time
  zone (`formatDateTime(value, timeZone?)`, additive), header select-all
  state derived from rows present. Writer: focused vitest 89 passed; tsc /
  eslint clean; pnpm test 873 passed / 1 skipped; pnpm build OK.
  Assess: high -> gentle-ai-verify PASS (incl. pnpm build; route dynamic).
  Parent spot check after fixes: component vitest 6 passed; tsc/eslint clean.
  Follow-ups: CardTitle renders div (section titles not semantic headings,
  repo convention); no tests for read-only tables/page gating.
- T5 (partial): `pnpm test` on HEAD dd0134c: 100 files passed / 1 skipped,
  873 tests passed / 1 skipped. tsc, eslint and `pnpm build` green in the
  T4 verification. PENDING: apply migration 20260909000000 to Supabase
  (needs explicit user authorization); manual browser check by the user.

## Next step
T5: closure checks; apply migration 20260909000000 only after explicit
user authorization; push/PRs are user decisions.
