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

S4 — The header shows the current location as a breadcrumb trail for nested routes
(`Resumen › Pagos › Validación mensual`), keeping the branch switcher, branch label and user name untouched.
Top-level routes render the section name without a trail.

S5 — Payments exposes one visible sub-navigation from each of its three screens — Resumen, Validar, Precios —
preserving the active branch in every tab link and marking the current tab as the active one.

## Tasks

- [ ] T1 — Section loading skeletons, error boundary and dashboard not-found (S1), route: inline, commit: TBD
- [ ] T2 — Teacher "Hoy" overview with quick access (S2), route: inline, commit: TBD
- [ ] T3 — Calendar default view by role (S3), route: inline, commit: TBD
- [ ] T4 — Header breadcrumb trail (S4), route: inline, commit: TBD
- [ ] T5 — Payments sub-navigation tabs (S5), route: inline, commit: TBD
- [ ] T6 — Docs, DESIGN.md note and close-out verification, route: inline, commit: TBD

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

### Slice boundary

Commit 1 (`7280bbe`) carried 521 authored lines because it includes twelve 13-line loading files that
share one skeleton; commit 2 (`15dd22e`) closed the recovery half at 242 lines. From T3 on, each task keeps
its own commit under the ~400-line slice.
