# Remove recurring classes from the calendar

User problem: there is no way to remove a recurring class. The server action
`deactivateScheduledClass` (soft-deactivate `scheduled_classes.is_active=false`,
never deletes, keeps attendance history) exists in
`lib/domain/classes/actions.ts` but no UI calls it.

## Decisions (user-confirmed)
- Entry point: button on each recurring session card in the calendar, next to
  "Suspender sesión", with a strong confirmation dialog. Applies to the whole
  recurring series, not just the shown date.
- Wording: "Quitar clase recurrente". Dialog copy: the class stops appearing
  from today, historical attendance is preserved, and the action cannot be
  undone from the app.
- Only for recurring sessions (`is_one_time === false`), gated by `canManage`
  and `branchId`, same gates as the suspend button.
- Only the full (non-compact) card gets the action, matching suspend/reinstate.

## Tasks
- [x] T1: Localization keys in `lib/localization/es-ec.ts` (action label, dialog
      title/description, confirm/cancel, success/error toasts, aria labels).
- [x] T2: New `components/classes/remove-recurring-class-dialog.tsx` calling
      `deactivateScheduledClass({ id, branch_id })`.
- [x] T3: Wire the dialog into `components/calendar/session-block.tsx` full card
      (recurring branch, alongside suspend/reinstate and teacher assign).
- [x] T4: Focused tests + scoped lint/tsc.

## Evidence
- Worker: gentle-ai-worker. New jsdom component test (4 cases: trigger/aria,
  dialog copy, confirm success path, failure path keeps dialog open).
- pnpm exec tsc --noEmit: exit 0. pnpm vitest run: 725 passed / 1 skipped,
  0 failed. Scoped eslint over changed files: clean.
- Deviations: call uses branch_id per schema (not branchId); AlertDialog instead
  of Sheet (repo convention for destructive confirm); error as role=alert.
- Parallel-session note: another session is editing lib/domain/roles/* and
  es-ec.ts ROLE_CREATION_MESSAGES (teacher-role-existing-account). This commit
  stages only this feature's hunks/files; roles changes remain unstaged.
- Commit: 928eae2 feat(calendar): allow removing recurring classes (branch feat/remove-recurring-class; final hash after amend: 826733a, merged to main)

## Round 2 — user feedback after testing (branch feat/recurring-removal-scope-history)
Findings: (1) removal only deactivated the single weekday row — the weekly
batch is stored as independent scheduled_classes rows with no group id, so
there was no way to remove the whole weekly package; (2) past occurrences
disappeared from the calendar because getSessionsForRange only loads
is_active templates.

User decisions: removal must target the WHOLE weekly series by default
(discipline + start_time across all weekdays), keeping history; a
single-weekday option must also exist "por cualquier eventualidad"; past
occurrences must remain visible in the calendar.

Round 2 tasks:
- [ ] T5: New server action deactivateScheduledClassSeries({ branch_id,
      discipline_id, start_time }) — soft-deactivates all ACTIVE
      scheduled_classes rows in the branch matching discipline+start_time,
      returns count. Same guard stack as deactivateScheduledClass.
- [ ] T6: getSessionsForRange keeps showing past occurrences (session_date
      strictly before today) of inactive templates, with their attendance
      overlay; occurrences from today onward stay hidden.
- [ ] T7: RemoveRecurringClassDialog gains a scope choice (RadioGroup):
      default "all classes with this schedule", secondary "only this weekly
      class"; copy updated (history preserved, past stays visible, not
      undoable); toast reflects count/scope.
- [ ] T8: Tests: schema tests, resolver test for past-occurrence visibility,
      dialog test update. tsc + scoped eslint + focused vitest.

## Evidence (round 2)
- Commit: 655b50d feat(calendar): remove whole recurring series and keep past classes visible
  (branch feat/recurring-removal-scope-history; final hash after rebase: 58d4ea4, merged to main)

## Round 3 — remove ALL future classes + proper series id (branch feat/remove-all-future-classes)
User request: third removal scope — delete EVERYTHING future (not just the
weekly series), without affecting past history. User also asked for a real id
for recurring series (today the batch rows are independent; round 2 used the
discipline+start_time heuristic). User confirmed scope includes future
one-time classes (requires one_time_classes.is_active migration).

Round 3 tasks:
- [ ] T9: Migration: scheduled_classes.series_id (uuid, indexed) + backfill
      grouping legacy rows by branch+discipline+start_time;
      one_time_classes.is_active (boolean, default true). Prisma schema synced.
- [ ] T10: createScheduledClass / createScheduledClassBatch assign series_id
      (batch shares one uuid).
- [ ] T11: deactivateScheduledClassSeries re-keyed to series_id (input:
      branch_id + scheduled_class_id; resolves the row's series_id).
      New deactivateAllFutureClasses(branch_id): soft-deactivates all active
      recurring templates + one-time classes with class_date >= today.
- [ ] T12: getSessionsForRange: one-time filter keeps past one-time classes
      visible (is_active OR class_date < today).
- [ ] T13: Dialog third radio "todo el horario futuro" + copy/toasts.
- [ ] T14: Tests (migration, schema, actions, resolver, dialog) + tsc + lint.

## Evidence (round 3)
- Worker: gentle-ai-worker. Migration 20260906000000 (transactional, no
  destructive ops): scheduled_classes.series_id + index, CTE backfill
  series_id = min(id) per (branch_id, discipline_id, start_time) covering all
  legacy rows; one_time_classes.is_active default true. Prisma schema synced;
  tracked generated client regenerated (pnpm exec prisma generate, offline).
- Actions: create stamps series_id (batch shares one uuid);
  deactivateScheduledClassSeries re-keyed to { branch_id, scheduled_class_id }
  -> series_id lookup -> updateMany (NOT_FOUND on missing/null);
  deactivateAllFutureClasses soft-deactivates all active recurring + one-time
  with class_date >= server-local today, returns { recurring, oneTime }.
- Resolver: one-time merge gate (is_active OR class_date < today) — past
  one-time classes stay visible.
- Dialog: third radio "all" ("Todo el horario futuro de la sucursal"),
  scope-aware toasts, normalizeStartTime removed (unused).
- Checks: tsc --noEmit clean; vitest 758 passed / 1 skipped / 0 failed;
  scoped eslint clean.
- IMPORTANT: migration NOT applied to any database — applying it is a user
  decision. Until applied, the Prisma client expects columns that do not
  exist in the DB.
- Commit: 573ef73 feat(calendar): series identity for recurring classes and remove-all-future scope (branch feat/remove-all-future-classes)
