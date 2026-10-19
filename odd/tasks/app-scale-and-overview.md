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

## Non-goals

- No change to attendance, payment or suspension rules.
- The full payments validation page (`/dashboard/payments/validation`) keeps its current content.
