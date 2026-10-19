# Feature: app-shell-polish

## Goal

Stage 4 of the authenticated-app redesign ("Tinta y sello"): close items 1-4 the final stage 3 finish review left
open on the shipped shell. Branch `feat/app-shell-polish`, stacked on `feat/app-scale-and-overview` (PR #203, not
merged yet) — retarget to `main` after #203 merges.

## Items (from the stage 3 final review)

1. Mobile header renders on paper while the direction contract promises an "ink top bar with sheet nav".
2. The 24px `SealMark` loses its inner square and reads as a generic check-circle.
3. At 768px the 288px rail crowds the header (title truncates, user name wraps) and the agenda rows.
4. DESIGN.md lacks the 24px ledger seal and the real mobile header surface.

Out of scope: marketing kicker bands and hard offset CTA shadow (the user keeps the public site as is).

## Decisions

- Mobile (< md): the site header becomes the ink top bar (`bg-sidebar`, sidebar ink text, brand mark), with the
  branch drawer trigger and user name restyled for ink; desktop header stays on paper next to the ink rail.
- Seal at small sizes: a dedicated small-size geometry (thicker ring, no inner square, bold check) instead of
  scaling the 56-unit hanko; the full hanko stays for 44px+.
- Tablet: from `md` to `lg` the rail starts collapsed to icons (`collapsible="icon"`), expanding from `lg`.

## Tasks

- [x] 1. Mobile ink top bar (dashboard + owner headers)
- [x] 2. Small-size seal geometry
- [x] 3. Icon rail between md and lg
- [x] 4. DESIGN.md + design.json + direction contract updated
- [ ] 5. Verify (tests, build, screenshots 390/768/1024/1440) + Impeccable verdict
- [ ] 6. Work-unit commits + PR

## Evidence

## Non-goals

- No changes to marketing, domain rules, routing or navigation items.
