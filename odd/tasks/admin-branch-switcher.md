# Feature: admin-branch-switcher

## Objective

The admin header branch combobox shows the branches where the admin has an
active assignment, on every dashboard screen except Mi perfil. Multi-assignment
(owner assigns an admin to branches) already exists in the DB and app; the data
layer needs no change. The earlier "global write" direction was explicitly
discarded by the user (2026-10-07): permissions stay branch-scoped.

Scope corrections found while exploring:
- Header page title showed "Resumen" on every route except Calendario; it must
  reflect the current screen.
- Mi perfil is not branch-scoped: hide the switcher (select and static label)
  there.

## Non-goals

- No RLS / permission changes; `assertCallerBranchAdmin` and
  `resolveBranchContext` keep requiring a branch-scoped admin assignment.
- Global-read-only pages (Calendario, Pagos) keep their current behavior.
- No sidebar changes.

## Tasks

- [ ] T1: SiteHeader — per-route page titles (including nested payments
      settings/validation), hide branch switcher UI on /dashboard/profile, new
      es-EC message keys, unit tests for the pure helpers.
- [ ] T2: Verification (vitest, tsc, eslint) + user browser check + closure
      evidence.

## Evidence log

- (pending)
