# Feature: assign-existing-admin

## Objective

Owner can assign the admin role on a branch to an ALREADY EXISTING account by
email alone. Today the only path is `createBranchAdmin`, which mandatorily
requires first name, surname and date of birth even when the account exists and
those fields are discarded (`mode: "assigned_existing"`).

Solution mirrors the existing teacher pattern
(`assignTeacherToExistingAccount` in `lib/domain/roles/actions.ts`): a new
email-only server action locates the Auth account by email, blocks duplicate
active admin assignments for the branch, and calls the authoritative
`assign_branch_admin` RPC. The full "create account" flow stays untouched for
brand-new admins.

## Non-goals

- No changes to `createBranchAdmin` or the new-account dialog.
- No changes to the `assign_branch_admin` RPC or RLS (DB authorization stays
  authoritative; owner-only).
- No profile auto-creation on the existing-account path (an account without a
  profile displays "Perfil pendiente", consistent with the staff table).

## Tasks

- [x] T1: `assignAdminToExistingAccount` action + schema (email-only), duplicate
      guard, es-EC messages, email-only "Asignar existente" dialog next to the
      create-account dialog in `components/owner/admin-assignment.tsx`, tests.
- [ ] T2: Verification (vitest, tsc, eslint, build) + user browser check +
      closure evidence, push + PR.

## Evidence log

- Independent verify PASS (no blockers): owner-gate parity and ordering with
  `createBranchAdmin`, no account/profile writes on the existing-account path,
  duplicate guard matches the `user_roles_active_uq` partial index, error
  mapping parity, UI behavior, es-EC copy. Commit `fd0fe9b` adds the
  `flex-wrap` guard on the header row (narrow-viewport overflow, confirm in
  browser). Follow-up: duplicate-guard `revoked_at IS NULL` filter has no
  regression test (mock ignores filters).
- T1 — Implemented `assignAdminToExistingAccountSchema` (email + branchId,
  mirroring the teacher-existing schema) in `lib/domain/roles/schema.ts`, and
  `assignAdminToExistingAccount` in `lib/domain/roles/actions.ts`: owner-only
  gate identical to `createBranchAdmin` (`getAuthenticatedContext` +
  `roles.includes("owner")`), module-private `findAuthUserIdByEmail` lookup,
  active-admin duplicate guard on `user_roles` reusing the existing
  `ROLE_CREATION_MESSAGES.ALREADY_ADMIN_IN_BRANCH` key (it already existed), and
  the authoritative `assign_branch_admin` RPC with the same authorization-error
  mapping as `assignBranchAdmin`. No profile or account creation.
  `lib/localization/es-ec.ts` gained only four `OWNER_MESSAGES` keys (trigger,
  title, description, submit label); success toast reuses
  `TOAST_MESSAGES.ADMIN_CARGO_ASSIGNED_EXISTING` and pending state reuses
  `COMMON_MESSAGES.LOADING`. `components/owner/admin-assignment.tsx` adds an
  outline-variant "Asignar existente" Sheet next to the create-account trigger
  with inline field errors, reset-on-close, toast + `router.refresh()` on
  success. Tests follow the existing vitest mocking patterns: 8 action cases in
  `actions.test.ts` and 4 render cases in the new
  `components/owner/admin-assignment.test.tsx` (jsdom + createRoot pattern).
  Commands: `pnpm exec vitest run lib/domain/roles` → 5 files / 48 tests passed;
  `pnpm exec vitest run lib/domain/roles components/owner/admin-assignment.test.tsx`
  → 6 files / 52 tests passed; `pnpm exec tsc --noEmit` → exit 0;
  `pnpm exec eslint lib/domain/roles components/owner lib/localization/es-ec.ts`
  → exit 0; `pnpm test` → 102 files / 896 tests passed, 1 skipped.
