# Admin role management: revoke wording + existing-account reassignment

Owner-reported friction: "Revocar" is ambiguous (suspend vs delete vs remove role),
and re-granting an admin role to a revoked admin fails because the only creation
path makes a NEW auth account (email already registered).

## Decisions
- "Revocar" wording becomes "Revocar cargo" everywhere in the owner admin/teacher
  revoke dialogs, with explicit copy that the account and data are NOT deleted.
- `createBranchAdmin` must look up an existing auth user by email first. If the
  account exists, do NOT create a new one: assign the role via
  `assign_branch_admin` RPC (idempotent), create the canonical profile only if
  missing, and return an "existing account" result (no temporary password).
- If the target already has an ACTIVE admin assignment for the branch, return a
  clear "already admin" error instead of a silent no-op.

## Tasks
- [x] T1: Update revoke wording in `lib/localization/es-ec.ts` (REVOKE_ACTION,
      REVOKE_ADMIN_TITLE/DESCRIPTION, REVOKE_ERROR, ADMIN_REVOKED) to
      "revocar cargo" semantics.
- [x] T2: Extend `createBranchAdmin` in `lib/domain/roles/actions.ts` with
      existing-email lookup (admin `listUsers`, same pagination pattern as
      `listBranchStaff`), active-assignment check via `user_roles`, and a
      discriminated result: `{ mode: "created", email, temporaryPassword } |
      { mode: "existing", email }`.
- [x] T3: Update `components/owner/admin-assignment.tsx` and
      `components/owner/created-account-dialog.tsx` to render the
      "existing account" outcome (no password section) and the new toasts.
- [x] T4: Extend `lib/domain/roles/actions.test.ts` with cases: existing email
      reuses account; already-active admin errors; new email creates account.
      Run focused vitest.

## Evidence
- Worker: gentle-ai-worker, TDD evidence: RED 4 failed / 5 passed -> GREEN
  9 passed (9) on lib/domain/roles/actions.test.ts; scoped eslint over the 5
  changed files clean; pnpm exec tsc --noEmit clean.
- Known environmental failures (pre-existing, files untouched by this feature):
  pnpm lint reports components/theme-toggle.tsx react-hooks/set-state-in-effect
  and lib/domain/students/actions.test.ts no-unsafe-function-type.
- Deviations: CreatedAccountCredentials kept as Extract<..., created> alias for
  out-of-surface teacher flow; listUsers failure maps to UNEXPECTED_ERROR to
  avoid duplicate account creation; description copy uses "correo electrónico"
  per es-EC file convention.
- Commit: dcc1781 feat(owner): reuse existing accounts for branch admins and clarify revoke wording (branch feat/admin-role-reassignment)
