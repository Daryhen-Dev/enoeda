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

- [ ] 1. Schema + action + messages: `assignTeacherToExistingAccountSchema` in
      `lib/domain/roles/schema.ts`, the action in `lib/domain/roles/actions.ts`,
      and the new `es-ec.ts` strings. Tests first in
      `lib/domain/roles/actions.test.ts`: existing email assigns the role;
      unknown email errors without creating anything; already-a-teacher errors;
      non-admin short-circuits; profile created only when missing.
- [ ] 2. UI: mode toggle in `components/staff/grant-role-dialog.tsx`, existing
      mode wired to the new action, create mode untouched, plus a component test
      for the toggle.
- [ ] 3. Checks: focused + full vitest, tsc, eslint, `next build`.
- [ ] 4. User: verify in the browser that an admin can give the teacher role to
      an existing admin's email and that the person then shows up both in
      Personal and in the calendar teacher picker.

## Out of scope

- Owner-surface teacher assignment (needs an SQL/RPC migration).
- Any change to `createBranchTeacher`, `createBranchAdmin` or the RPCs.

## Evidence

(filled in as tasks close)
