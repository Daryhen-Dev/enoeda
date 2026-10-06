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
- Commit: 928eae2 feat(calendar): allow removing recurring classes (branch feat/remove-recurring-class)
