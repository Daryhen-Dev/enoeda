# Remove the "Seleccione una sucursal" interstitial

## Problem

A multi-branch admin opening any dashboard page without `?branch` sees two
branch pickers at once: the combobox in the header (rendered by
`app/dashboard/layout.tsx`) and a full-page grid of branch cards
(`components/branch/branch-selector.tsx`, rendered by 7 pages). The user's
decision: the combobox alone is enough and the interstitial goes away.

## Mechanism today

`resolveBranchContext` (`lib/auth/branch-context.ts`) returns one of
`valid | redirect | selector | error`:

- `?branch` matches an active branch → `valid`.
- exactly one active branch, param absent or wrong → `redirect` to it.
- more than one active branch, no match → `selector` → the page renders the
  card grid. There is no implicit default.

The header renders its switcher from a separate code path
(`lib/auth/operational-branches.ts` via the layout) and derives the selection
from `?branch` only, so the two surfaces disagree whenever the param is
missing.

## Design

Replace `selector` with a deterministic default, so the combobox becomes the
only branch picker:

- When `?branch` is missing or does not match an active branch, redirect to the
  **first active branch ordered by name** (Spanish collation, tie-break by id)
  instead of only when there is exactly one branch.
- Drop `selector` from `BranchContextResult`, delete
  `components/branch/branch-selector.tsx`, and remove the `selector` branch from
  the 7 dashboard pages that render it.
- `error` keeps its current `NO_BRANCH_CONTEXT` alert; nothing else changes.

Sorting by name makes the default predictable and testable, and matches the
first option the user sees in the combobox.

## Tasks

- [x] 1. `lib/auth/branch-context.ts`: default to the first active branch by
      name when the param is missing or unmatched; remove the `selector`
      variant. Update `lib/auth/branch-context.test.ts`: the two `selector`
      cases become redirects, plus a determinism case (assignments listed in
      reverse order still pick the same branch).
- [x] 2. Remove the interstitial: delete `components/branch/branch-selector.tsx`
      and its `selector` handling + import in the 7 dashboard pages.
- [x] 3. Checks: vitest, tsc, eslint, `next build`; grep confirming no
      `BranchSelector`/"Seleccione una sucursal" references remain.
- [ ] 4. User: verify in the browser that a multi-branch admin lands on a branch
      with content and only the header combobox, on all 7 pages.

## Deliberate omissions (found in the same audit, not in this change)

- Sidebar links (`components/app-sidebar.tsx:102,123`) do not preserve
  `?branch`, so switching pages resets the admin to the default branch. Fixing
  that is the natural follow-up; it is the cheap half of "remember last branch".
- The header `<select>` carries both an `sr-only` label "Cambiar sucursal" and
  `aria-label="Sucursal activa"`; the `aria-label` wins and the label is dead.
- Page headings that repeat the header or the sidebar label: `Calendario`
  (`app/dashboard/calendar/page.tsx:48`), `Estudiantes`, `Profesores`,
  `Mi perfil`, and the owner shell's `Resumen`/`Sucursales`/`Disciplinas`.
- Dialog titles that copy their trigger button verbatim: `Asignar profesor`,
  `Asignar administrador`, `Crear clase recurrente`, `Crear clase única`,
  `Crear disciplina`.

## Evidence

- Task 1-3: one work-unit commit `f0bcc27` fix(dashboard): default to the first
  branch instead of a picker screen (10 files, +61/-182). The resolver change
  and the call-site removals cannot ship apart: deleting the `selector` arm of
  the union makes any leftover handler a TS2367 error, so splitting the commit
  would leave a tree that does not typecheck.
- TDD: the rewritten resolver tests were RED first (3 failed / 14 passed against
  the old `selector` return), then GREEN (17 passed). The determinism test
  reverses both the assignment order and the mocked DB row order, so it fails
  if the default ever comes from input order instead of the name sort.
- Independent verification in the working tree: 9/9 PASS. `git diff -U0` on the
  7 pages shows only deletions, so the `error` and `redirect` handling is
  byte-identical; all 7 preserve the other search params when redirecting; full
  vitest 702 passed / 1 skipped; `next build` ok with all 7 routes; `tsc` clean;
  eslint on the changed files 0 errors.
- Corrected acceptance check: my original grep for "Seleccione una sucursal"
  matched `STUDENT_FORM_MESSAGES.ACTIVE_BRANCH_REQUIRED/PLACEHOLDER` in
  `lib/localization/es-ec.ts:285-286`. Those feed the branch `<Select>` of the
  student form dialog (placeholder + required-field message), a different
  control where the wording is correct. Re-checking for the exact interstitial
  strings (`Tiene acceso a múltiples sucursales`, the standalone heading) and
  for `BranchSelector` returns nothing.
- Not verified: browser behaviour. The resolver and the build are proven, but
  what a multi-branch admin actually sees after this change needs one manual
  pass (task 4).

## Follow-ups found while working

- `components/app-sidebar.tsx:102,123` links do not carry `?branch`, so after
  this change navigating between pages resets the admin to the alphabetically
  first branch; a manual choice survives only within one page. This is the cheap
  half of "remember the last branch" and is the obvious next change.
- `.open-next/` (82 MB, gitignored) is stale build output from the removed
  Cloudflare toolchain and is not in eslint's `globalIgnores`, so a project-wide
  `pnpm exec eslint` reports ~730 errors from it. Deleting the directory fixes
  the noise; adding an ignore rule would re-introduce config for a toolchain
  that no longer exists.
- Pre-existing warning, outside this diff: `app/dashboard/staff/page.tsx:77`
  `'teachers' is assigned a value but never used`.
