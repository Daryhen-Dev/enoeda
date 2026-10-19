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
- [ ] 2. UI: attendance sheet redesign (counter, mark all, rows, notes, sticky save, seal) + copy + tests
- [ ] 3. Verify: tests, tsc, eslint, build, browser screenshots (mobile + desktop)
- [ ] 4. Impeccable finish review + DESIGN.md for the "Tinta y sello" system
- [ ] 5. Work-unit commits + PR

## Evidence

## Non-goals

- No change to attendance rules, windows, permissions or payment registration behavior.
