# Assign the teacher role to an existing account

## Problem

An admin cannot give the `teacher` role to a person who already has an account.
"Asignar profesor" in `app/dashboard/staff` only creates brand-new accounts:
`createBranchTeacher` (`lib/domain/roles/actions.ts:418`) always calls
`admin.auth.admin.createUser(...)` and returns `EMAIL_ALREADY_EXISTS` for any
email that is already registered. The owner panel only knows about admins
(`components/owner/admin-assignment.tsx` hardcodes `admin`), so there is no
other screen for it either.

The data model and the database already allow it: `user_roles` is unique per
`(user_id, role, branch_id)` with `revoked_at IS NULL`, so one person can hold
`admin` and `teacher` at once, and the `assign_branch_teacher` RPC authorizes
admin-of-branch and upserts with `ON CONFLICT DO NOTHING`. The gap is UI plus
one action.

## Decisions (resolved with the user)

- Surface: the branch admin's "Personal" page. The owner surface is out of scope
  because `assign_branch_teacher` rejects `owner` in SQL and that would need a
  migration.
- The email must belong to an existing account: this flow never creates one.

## Design

One dialog, two modes, defaulting to "Cuenta existente":

- **Cuenta existente** (new): looks the email up, assigns the teacher role via
  the existing RPC, and ensures a canonical profile exists.
- **Crear cuenta** (today's behaviour, unchanged): creates the auth account with
  a temporary password.

A mode toggle instead of two near-identical buttons, because two controls whose
labels differ only by a word is the redundancy we just removed from branch
picking.

### The profile trap

`listBranchTeacherOptions` (`lib/domain/roles/actions.ts:592-621`) maps only
`user_profiles` rows, so a teacher with no canonical profile is invisible when
assigning classes in the calendar, even though `listBranchStaff` still shows
them by falling back to the email. Assigning a role to a profile-less account
would therefore create a half-working teacher.

So the "Cuenta existente" mode also collects first name and surname and creates
the profile **only when missing**, never overwriting an existing one — exactly
what `createBranchAdmin` does since `ef37466`.

### New action

`assignTeacherToExistingAccount({ email, branchId, first_name, surname, phone?,
date_of_birth })`:

1. Validate with a new schema reusing the existing field validations.
2. Require an authenticated admin-of-branch (same check as
   `createBranchTeacher`; the RPC stays authoritative).
3. `findAuthUserIdByEmail` → `not_found` returns a new
   `NO_ACCOUNT_FOR_EMAIL` message; a lookup failure returns the generic error.
4. An active teacher assignment in the same branch returns a new
   `ALREADY_TEACHER_IN_BRANCH` message.
5. `assign_branch_teacher` RPC with `p_target`.
6. Ensure the canonical profile exists (create only if missing).
7. Success carries the email only — no password, so no `CreatedAccountDialog`.

## Tasks

- [x] 1. Schema + action + messages: `assignTeacherToExistingAccountSchema` in
      `lib/domain/roles/schema.ts`, the action in `lib/domain/roles/actions.ts`,
      and the new `es-ec.ts` strings. Tests first in
      `lib/domain/roles/actions.test.ts`: existing email assigns the role;
      unknown email errors without creating anything; already-a-teacher errors;
      non-admin short-circuits; profile created only when missing.
- [x] 2. UI: mode toggle in `components/staff/grant-role-dialog.tsx`, existing
      mode wired to the new action, create mode untouched, plus a component test
      for the toggle.
- [x] 3. Checks: focused + full vitest, tsc, eslint, `next build`.
- [ ] 4. User: verify in the browser that an admin can give the teacher role to
      an existing admin's email and that the person then shows up both in
      Personal and in the calendar teacher picker.

## Out of scope

- Owner-surface teacher assignment (needs an SQL/RPC migration).
- Any change to `createBranchTeacher`, `createBranchAdmin` or the RPCs.

## Evidence

- Task 1: `faa3bb6` feat(roles): assign the teacher role to an existing account
  (schema + action + 9 new action tests + 2 messages + barrel export).
- Task 2: `feat(staff)` commit — dialog mode toggle (`ToggleGroup`, the
  single-select segmented the repo already ships, no new dependency) +
  `components/staff/grant-role-dialog.test.tsx` (4 tests) + the new copy and the
  stale `ASSIGN_DIALOG_DESCRIPTION` UUID fix.
- Test-first on both units: 9 action tests RED (missing export) then 18/18
  green; 4 dialog tests RED then 4/4 green.
- Mutation check on the coverage gap the verifier found: deleting the
  `router.refresh()` call fails
  `assigns the role to the existing account and never creates one`, so the
  assertion is real rather than decorative.
- Independent verification: 10 items, 9 PASS. Confirmed by reading the code that
  no path calls `createUser`/`deleteUser`, the admin-of-branch check precedes the
  email lookup, the already-teacher block is branch-scoped (`revoked_at IS NULL`
  for this branch, so a teacher of another branch stays assignable), the profile
  is only inserted when absent and never updated, and the create-mode body is
  byte-identical to the pre-feature file.
- Gates: full vitest 725 passed / 1 skipped; `next build` ok; `tsc --noEmit`
  clean; eslint clean on the changed files.
- Not verified: anything needing a live Supabase or a browser — real
  `assign_branch_teacher` authorization, `listUsers` pagination, the rendered
  `ToggleGroup` semantics, and the intended end state of one person holding
  `admin` + `teacher`.

## Follow-ups

- ~~`lib/localization/es-ec.ts` `TARGET_USER_LABEL: "ID de usuario (UUID)"` was a
  dead constant with no consumer, left over from the pre-email flow. My
  acceptance grep for "uuid" hit it.~~ Resolved: deleted in
  `chore/remove-dead-target-user-label` after confirming zero code references
  (name, case-insensitive, computed-key and spread access all checked) with the
  build, `tsc` and the full suite green.
- Owner-surface teacher assignment still needs the `assign_branch_teacher` RPC to
  stop rejecting `owner`, i.e. a migration.

## Process note

This work started in `C:/Proyects/enoeda` and finished in the isolated worktree
`C:/Proyects/enoeda-teacher`. The parallel session switched the shared tree's
branch to `feat/remove-recurring-class` mid-flight, which left my uncommitted
work sitting on their branch and mixed my `es-ec.ts` lines with theirs. Moved out
with `git diff` + `git apply`, then reverted only my own files, so neither
feature contaminated the other's history.
