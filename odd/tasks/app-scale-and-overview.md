# Feature: app-scale-and-overview

## Goal

Stage 3 of the authenticated-app redesign ("Tinta y sello"). Close the two items the Impeccable finish
review left open on shipped surfaces:

- **#8 root scale:** `html { font-size: 18px }` multiplies every rem in the app. Move the authenticated app
  to a 16px root with an explicit readable text scale, keeping the public marketing site at 18px.
- **#7 admin overview:** `/dashboard` leads with three equal stat cards (hero-metric template). Rebuild it
  action-first.

Branch `feat/app-scale-and-overview` from `main` (after #201 and #202 merged).

## Decisions (user, 2026-10-19)

- Root scale: 16px in the app with readable text set explicitly; marketing stays at 18px.
- Overview blocks: (A) today's classes and their attendance (sealed / pending / suspended), (B) payments that
  need action (to suspend, in grace) with direct links. Totals were not selected as a block.
- One PR per stage; #201 and #202 merged before starting.

## Tasks

- [x] 1. Root scale: 16px app root, marketing pinned at 18px, readable app text scale
- [x] 2. Overview: today's classes with attendance state + payments needing action
- [ ] 3. Verify: tests, tsc, eslint, build, screenshots (app + marketing unchanged)
- [ ] 4. Impeccable verdict on #7/#8 + DESIGN.md update
- [ ] 5. Work-unit commits + PR

## Evidence

- T1 `b1a3ec1`: `html { font-size: 16px }`; `html:has([data-marketing-page])` keeps 18px; app-only
  `--text-sm: 0.9375rem` (15px). Verified in the production build: marketing root 18px and Tailwind `text-sm`
  15.75px on `/` and `/kickboxing` (no token leak), `/login` root 16px with 15px body; sidebar 324 -> 288px,
  header 54 -> 48px.
- T2 `e4b9be6` (delegated, gentle-ai-worker): `/dashboard` leads with "Hoy" + branch-tz date + ledger summary;
  (A) "Clases de hoy" ruled rows with sealed (seal + present count) / pending (ink pill + "Tomar asistencia"
  via `AttendanceSheetDialog`) / suspended (grey + reason); (B) "Pagos que requieren acción" (admins only,
  streamed in Suspense): "A suspender" then "En gracia", top 5 each, link to the validation page. KPI trio,
  greeting and `getDashboardKpis` removed (no other consumers). Pure helper `buildTodayAgenda` + tests.
- Browser (temporary preview routes with synthetic data, deleted): desktop two columns, one seal red + one
  carmine count as the only reds, no console errors. Mobile overflowed (566px at 390) because the grid columns
  lacked `min-w-0` and rows were single-line; fixed with `min-w-0` and stacked mobile rows (status left,
  action right). Recapture: 390/768/1440 no horizontal overflow.
- Checks: full `pnpm test` 133 files / 1376 passed, 1 skipped; tsc clean; eslint clean on touched files
  (one pre-existing warning in `app/dashboard/staff/page.tsx`, untouched); `pnpm build` ok.
- Known: at 768px the 288px sidebar leaves narrow text columns (ellipsis) — pre-existing `md:` sidebar breakpoint.

## Non-goals

- No change to attendance, payment or suspension rules.
- The full payments validation page (`/dashboard/payments/validation`) keeps its current content.
