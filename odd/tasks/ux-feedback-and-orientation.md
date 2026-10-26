# Feature: ux-feedback-and-orientation

## Goal

Slices 1-4 of the usability evaluation: give the app immediate feedback while navigating, give the teacher
their own "Hoy" home, make the calendar open on the day the teacher actually works, and make nested routes
and the payments section navigable without guessing.

## Specs

S1 — Every dashboard section route renders a loading skeleton shaped like its destination while the server
response is pending, and a recoverable error boundary with a "Reintentar" action when the section fails.
Scope: `/dashboard`, `/dashboard/students`, `/dashboard/students/[id]`, `/dashboard/calendar`,
`/dashboard/payments`, `/dashboard/payments/validation`, `/dashboard/payments/settings`, `/dashboard/conduct`,
`/dashboard/schedule`, `/dashboard/staff`, `/dashboard/belts`. A missing student gets a `not-found` screen
inside the dashboard shell instead of the framework default.

S2 — A teacher-only user keeps the `/dashboard` "Hoy" overview instead of being redirected to the calendar:
today's agenda with its attendance action, plus reachable quick access to "Registrar multa o llamado" and
"Buscar estudiante". The overview item stays visible in the sidebar for teacher-only users; admin-only items
stay hidden from them.

S3 — The calendar opens in `day` view for a teacher-only user and in `month` view for an admin when no `view`
query parameter is present. An explicit `?view=` always wins for both.

S4 — The header shows where the user is on nested routes: the parent section renders as a breadcrumb link
before the page title (`Pagos › Validación mensual`), keeping the active branch in the link. Top-level routes
keep the bare section title, and a student detail keeps its own back link instead of repeating "Estudiantes".

S5 — Payments exposes one visible sub-navigation from each of its three screens — Resumen, Validar, Precios —
preserving the active branch in every tab link and marking the current tab as the active one.

## Tasks

- [x] T1 — Section loading skeletons, error boundary and dashboard not-found (S1), route: inline, commit: 7280bbe + 15dd22e
- [x] T2 — Teacher "Hoy" overview with quick access (S2), route: inline, commit: 365a0de
- [x] T3 — Calendar default view by role (S3), route: inline, commit: cfc1c1c
- [x] T4 — Header breadcrumb trail (S4), route: inline, commit: 9af3336
- [x] T5 — Payments sub-navigation tabs (S5), route: delegated (gentle-ai-worker), commit: b23a50c
- [x] T6 — Docs, DESIGN.md note and close-out verification, route: inline, commit: pending

## Log

L1 (verbatim user request): "listo, vamos con los 4 primeros, crea una rama y vamos con todo"

L2 (decision, T2): the overview keeps `PaymentsActionPanel` admin-only (it already renders only when
`branchResult.canManage`); for teacher-only users the same page renders the agenda plus a compact quick-access
strip. No new route is introduced, so bookmarks to `/dashboard/calendar` keep working.

L3 (decision, S1): one `error.tsx` at `app/dashboard` covers every page error below that segment (the layout
lives in the same segment, so its own errors stay with the framework boundary). Section `loading.tsx` files
share one skeleton component instead of eleven copies.

L4 (decision, S5): tabs are links between the three existing routes, not in-place tabs. URLs, deep links and
the existing server actions stay untouched.

## Evidence

- `7280bbe` — S1 loading half: `SectionSkeleton` (panel/table/detail/calendar variants), twelve segment
  `loading.tsx` boundaries and `app/dashboard/loading-boundaries.test.ts`, which pins the segment list so a new
  section cannot ship without a placeholder. 521 authored lines, mostly 13-line boundary files (see below).
- `15dd22e` — S1 recovery half: one `app/dashboard/error.tsx` with a `Reintentar` action and
  `app/dashboard/not-found.tsx` for `notFound()` from the student detail.
- `365a0de` — S2: the `/dashboard` teacher redirect is gone, `OverviewQuickActions` adds conducta and student
  search, and the payments column stays behind `canManage`. The overview item is back for teacher-only users
  in `getVisibleNavigationItems`.
- `cfc1c1c` — S3: `resolveCalendarView` (pure, tested) drives the calendar default; teacher-only lands on
  `day`, admin on `month`, explicit `?view=` wins.
- `9af3336` — S4: `getBreadcrumbAncestors` + `buildBreadcrumbHref` render the parent section link before the
  page title on `md+`, keeping the active branch; top-level routes render bare.
- `b23a50c` — S5, delegated to `gentle-ai-worker`: `PaymentsSectionNav` links the three payments routes with
  `aria-current="page"`, replacing the two console header buttons and the validation back link.
- T6 — DESIGN.md navigation patterns (breadcrumb, section sub-nav, loading/failure surfaces) and the two
  message keys orphaned by T5 removed (`PAYMENT_MESSAGES.SETTINGS_LINK`, `PAYMENT_VALIDATION_MESSAGES.BACK_LINK`).

### Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on every touched file: clean (the only repo warning, an unused `teachers` binding in
  `app/dashboard/staff/page.tsx`, predates this feature).
- `pnpm build`: exit 0; every dashboard route compiles with its new loading/error/not-found boundary.
- `pnpm vitest run`: 1434 passed, 1 skipped, 1 failed. The failure is `lib/domain/classes/get-sessions-resolver.test.ts:248`
  ("keeps active template occurrences from today onward unchanged"): it asserts a strictly future Monday, and
  the run happened at 00:02 on Monday 2026-10-26, so the next Monday *is* today. `git diff main --
  lib/domain/classes lib/date.ts` is empty, so the case reproduces on `main` with the same clock; it is left
  untouched as out of scope for this feature.
- Delegated slice (T5) verified by the parent: diff read, worker's own RED/GREEN re-run plus the
  payments/dashboard/header scope and the full build.

### Slice boundary

Commit 1 (`7280bbe`) carried 521 authored lines because it includes twelve 13-line loading files that
share one skeleton; commit 2 (`15dd22e`) closed the recovery half at 242 lines. From T3 on, each task keeps
its own commit under the ~400-line slice.
