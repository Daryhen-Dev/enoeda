# Password recovery (forgot password)

## Problem

Admins and teachers who forget their password have no self-service recovery:
there is no "forgot password" link, no `resetPasswordForEmail` usage anywhere,
and `/auth/callback` hard-redirects every successful code exchange to
`/student`, so even a Supabase recovery email would land staff in the wrong
shell. Today the only path is a manual Supabase dashboard reset.

## Design

- `requestPasswordRecovery` (server action): validates the email, calls
  `resetPasswordForEmail` with `redirectTo: <origin>/auth/callback?next=%2Freset-password`.
  The origin comes from request headers (works on any deployment domain).
  The response is enumeration-neutral: valid input always reports success.
- `/auth/callback`: `next` is allowlisted to exactly `/reset-password`;
  anything else keeps the existing fixed `/student` destination.
- `/forgot-password` and `/reset-password` join `PUBLIC_PATHS`; the reset page
  itself requires a session (recovery link) and redirects to
  `/forgot-password` without one. After a successful change it sends the user
  to their role home (`/dashboard` for admin/teacher/owner, `/student` for
  students).
- Password change reuses the existing `changeOwnPassword` server action
  (session-scoped `updateUser`; also clears `must_change_password`).

## Tasks

- [x] 1. Recovery action + callback allowlist + public paths (+ tests).
- [x] 2. Pages, forms, login link, localization.
- [x] 3. Checks: vitest, tsc, eslint, next build.

## User follow-ups (outside repo)

- Supabase Auth redirect URLs must allow `/auth/callback` for every deploy
  domain (enoedadojo.com, enoeda.vercel.app).

## Evidence

- Commit: `bffd9e6` feat(auth): password recovery flow for admins and teachers
  (branch feat/password-recovery, not pushed yet).
- Checks: vitest 701 passed / 1 skipped (the import-policy filesystem walk is
  occasionally slow on this machine and can time out; reruns pass), tsc clean,
  eslint clean, next build renders /forgot-password (static) and
  /reset-password (dynamic).
- Pending user: Supabase Auth redirect URLs must allow /auth/callback for
  every deploy domain.
