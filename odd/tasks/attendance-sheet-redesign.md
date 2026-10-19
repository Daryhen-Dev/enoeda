# Feature: attendance-sheet-redesign

## Goal

Stage 2 of the authenticated-app redesign ("Tinta y sello"): rebuild the attendance sheet — the teacher's
most frequent action, done one-handed on a phone at the mat — and land the direction's signature move
(the vermilion seal on finished work). Close the stage with the Impeccable finish review and DESIGN.md.

Branch `feat/attendance-sheet-redesign`, stacked on `feat/app-visual-foundation` (PR #201): it uses the
stage-1 tokens (`--seal`, ink/paper palette). PR base: `feat/app-visual-foundation` until #201 merges.

## Decisions

- From the chosen direction (user, 2026-10-16): live present/total counter, mark-all control, sticky save,
  each student shows the real belt color of their current level, the seal stamps the sheet on save.
- Whole row is the tap target for present/absent (one-handed use); observation collapses behind
  "Agregar nota" and opens automatically when a note already exists.
- Seal: shown in the sheet when the session already has saved attendance, and stamped on successful
  save before the sheet closes (short delay; no animation under prefers-reduced-motion).
- Belt data: `getAttendanceForSession` returns each student's current level name/color in the session's
  discipline (latest `student_progress`), null when none. Read-only addition; no write path changes.
- Out of scope: calendar session block (its hardcoded sky/emerald/amber colors move to tokens in a later
  calendar stage), guests flow logic.

## Tasks

- [x] 1. Domain: current belt (level name/color) per attendance entry + tests
- [x] 2. UI: attendance sheet redesign (counter, mark all, rows, notes, sticky save, seal) + copy + tests
- [x] 3. Verify: tests, tsc, eslint, build, browser screenshots (mobile + desktop)
- [ ] 4. Impeccable finish review + DESIGN.md for the "Tinta y sello" system
- [ ] 5. Work-unit commits + PR

## Evidence

- T1 `eff4837`: `getAttendanceForSession` adds `level_name`/`level_color` from the latest `student_progress`
  per student in the session's discipline (one batched query, skipped when empty); 2 new tests.
- T2 (delegated, gentle-ai-worker, plus one fix round): live "N de M presentes" counter, "Todos presentes /
  Todos ausentes", two-line rows (full-width label tap target with belt swatch + wrapping name + checkbox;
  meta row outside the label with source badge, "Ausente" marker, note preview, note toggle, "Cobrar clase"),
  collapsed notes, sticky save footer, skeleton loading, Empty state, and the seal (`AttendanceSeal`: ring +
  inner square + check mark in `--seal`, visible "Registrada" label in ink, `role="img"` "Asistencia
  registrada"). Seal shows on open when the session already has records, and stamps over the list on save
  (650ms, 0ms with reduced motion) before refresh/close. New copy keys in `ATTENDANCE_FORM_MESSAGES` only.
- Browser round 1 found: belt swatch hydration mismatch (`CSS.supports` branch), seal text clipped, names
  truncated on narrow rows. Round 2 (after fixes): 0 console errors, all belt colors rendered, no clipping
  (seal bbox inside viewBox), full names with line-clamp-2, per-class row with no overlaps, meta-row clicks do
  not toggle attendance, no horizontal overflow at 390 and 1440. Submit against the real action without a
  session shows "Debe iniciar sesión para continuar." (real success path, toast and stamp animation not
  observed: needs an authenticated session).
- Checks: full `pnpm test` 131 files / 1356 passed, 1 skipped; tsc, eslint, `git diff --check` clean;
  `pnpm build` ok; Impeccable detector `[]`.
- Finish review (Impeccable reviewer run inline in a fresh read-only subagent; the shipped reviewer agent is
  not available in this harness): `disposition: fix`, 8 material fixes. Fix batch applied: ledger rows (1px rule
  in every state, no card stack), seal bound to the saved record (hidden + "Cambios sin guardar" when edited),
  title outranks the count (count on one line), absent names keep ink with an outlined "Ausente" pill, FORM seed
  replaced by `seed:97f65a55ae679f12` (check-seed exit 0), brief pins Geist as user-approved workhorse type.
  Verdict pass: #1-#5 resolved, #6 partial (grey level text on the absent tint), #7 shell stat trio and #8 18px
  root unresolved (out of this stage), 2 regressions (row pitch ~117px, doubled rule above the save bar).
  Tests after the batch: 48 attendance tests, full suite 1358 passed / 1 skipped; tsc, eslint, build clean.
- Known (pre-review): mobile counter wraps to two lines next to the seal; plain rows are ~96px because the meta row always
  carries the note toggle.

## Non-goals

- No change to attendance rules, windows, permissions or payment registration behavior.
