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
- [x] 5. Verify (tests, build, screenshots 390/768/1024/1440) + Impeccable verdict
- [x] 6. Work-unit commits + PR

## Evidence

- `8ea7b4d` (delegated, gentle-ai-worker): ink header below md (dashboard + owner, emblem only there, title 16.62:1),
  `collapsible="icon"` + compact default md-lg in the sidebar state provider (collapses once on entering 768-1023,
  restores the user's choice on leaving; trigger still toggles), small-size seal geometry.
- `bf5a2ef`: DESIGN.md, design.json and the direction contract describe the shell by width and the ledger seal.
- Browser (temporary preview routes with synthetic data, served by the user's running dev server on :3003 because
  it held `.next/dev/lock`; it was not stopped): sheet <768, 48px icon rail at 768 with tooltips, 288px from 1024,
  trigger toggles, resize ends expanded; no overflow at 390/768/1024/1280/1440; 0 console errors.
- At 1024 the expanded rail left the 7/5 panels ~390px and names truncated -> `1616a86` panels stack until xl.
- Finish review: `fix` with 3 items -> `516e286` 24px seal redrawn with ring + inner square + check (every stroke
  >= 1 device pixel), DESIGN.md Shapes reconciled, tooltip capture added. Verdict pass: all 3 resolved,
  `disposition: ship` scoped to those fixes. Ceiling notes left as ideas (stamp animation on in-place state change,
  ink bar hinting sheet nav).
- Checks: full `pnpm test` 135 files / 1387 passed, 1 skipped; tsc clean; `pnpm build` ok; detector `[]`.

## Non-goals

- No changes to marketing, domain rules, routing or navigation items.
