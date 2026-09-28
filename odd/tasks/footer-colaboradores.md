# Feature: footer-colaboradores

## Goal

Add an institutional collaborators strip to the bottom of the marketing footer: four partner
logos, each with a single role line, without competing with the existing WhatsApp CTA.

## Scope decision (resolved with the user)

- Format chosen: **logo + one role line** (not photos-only, not a paragraph per collaborator).
- Relationship asserted: **all four are formal backing** ("respaldo formal"). Copy stays generic
  per type; no specific contract, venue, or certification claims are invented.
- Placement: inside `MarketingFooter`, between the main grid and the legal bar.

## Context (discovered during scan)

- The four assets are **institutional logos, not portraits**: AKR Internacional, Concentración
  Deportiva de Pichincha, FEK Ecuador Karate, KORU Rehabilitación Física y Fisioterapia.
- FEK is already referenced in `components/marketing/home/sections/masters.tsx` credentials
  ("2do Dan en Karate FEK", "3er Dan FEK Shotokan"), so the federation is established domain context.
- Footer background is `--marketing-surface: #02142a` (near-black navy).

### Pixel analysis of the source PNGs (corrects the initial assumption)

All four are `RGBA` with a **transparent** background (alpha 0 in every corner, 28-56% of pixels
transparent). The white seen when previewing them came from the viewer compositing on white, not
from the file. Composition of opaque pixels:

| Asset | near-white | near-black | Reads on navy |
| --- | --- | --- | --- |
| `enoedaColaborador1.png` (AKR) | 38.0% | 5.1% | white disc, acceptable |
| `enoedaColaborador2.png` (CDP) | 0.5% | 2.7% | gold line art, best |
| `enoedaColaborador3.png` (FEK) | 3.0% | **48.8%** | **half the eagle disappears** |
| `enoedaColaborador4.png` (KORU) | 70.6% | 0.0% | white circle, acceptable |

Consequence: dropping the logos straight onto the navy footer produces four different visual
behaviours and breaks FEK. Light chips fix contrast and uniformity. The original justification
("PNGs have a white background") was wrong; the conclusion survived for a different reason.

Second consequence: because backgrounds are transparent, chip fill must be **pure white** so the
logos' own internal white fields (KORU 70%, AKR 38%) merge instead of showing a seam against the
off-white `--marketing-foreground: #f1faee`.

All four are ~1254x1254 (AKR 1282x1227), 4.7 MB total at source. Next's static-import optimizer
serves them as WebP/AVIF; `sizes` must reflect the small rendered box (~180px), not the source width.

### Redundancy found in the first draft of the plan

Every logo already renders its own name as a wordmark inside the artwork. Printing the name again
as text duplicates it. Final structure: chip = logo only; below the chip = **role line only**.
The name lives in `alt`.

## Tasks

- [x] 1. Data module `components/marketing/shared/collaborators.ts`
- [x] 2. Collaborators strip in `components/marketing/shell/footer.tsx`
- [x] 3. Resolve `ENOEDA` watermark collision with the new strip
- [x] 4. `components/marketing/shell/footer.test.tsx` guards the strip
- [x] 5. Verify: `pnpm lint`, `pnpm test`, visual pass at mobile + desktop
- [x] 6. Work-unit commit on the feature branch (evidence recorded below)

## Commit evidence

- `aaf3fab` — `feat(marketing): add institutional collaborators strip to footer`
  on `feat/footer-colaboradores`: 8 files, 329 insertions(+), 7 deletions(-).
- Merged into `main` by fast-forward (`main` had not moved since the branch point
  `85e48b3`), so the branch adds exactly one commit and no merge commit.
- Post-merge verification on `main`: 683 tests passed / 1 skipped, `tsc --noEmit` clean.
- Not pushed: push and PR remain the user's decision.

## Verification results

| Check | Result |
| --- | --- |
| `npx vitest run components/marketing/shell/footer.test.tsx` | 3 passed |
| `pnpm test` (full suite) | 83 passed, 1 skipped — 683 tests, no regression |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx eslint` on the 3 touched files | 0 errors, 0 warnings after disabling `no-img-element` on the test stub |
| SSR render at `http://127.0.0.1:3001/` | heading id, intro, 4 roles and 4 `<img>` present in real DOM |

### Pre-existing lint failures (not introduced here)

`pnpm lint` exits 1 on `main` independently of this change: 2 errors in
`components/theme-toggle.tsx:14` (`react-hooks/set-state-in-effect`) and
`lib/domain/students/actions.test.ts:46` (`no-unsafe-function-type`), plus 497 warnings.
Left untouched; worth its own work unit.

### Weight measured, not assumed

Next's static-import optimizer handles the conversion; no manual asset pipeline was added.
Requested through `/_next/image` with `Accept: image/avif,image/webp`:

| Asset | Source PNG | @640px WebP | @256px WebP (real rendered size) |
| --- | --- | --- | --- |
| AKR | 1513.9 KB | 85.2 KB | — |
| CDP | 1305.5 KB | 135.6 KB | — |
| FEK | 578.9 KB | 39.4 KB | — |
| KORU | 1226.7 KB | 52.7 KB | — |
| **Total** | **4625 KB** | **312.9 KB** | **90.9 KB** |

Gotcha found while measuring: without an `Accept` header the optimizer returns resized **PNG**,
not WebP. A probe that forgets the header under-reports the win by ~3.5x.

### Optical scale check

Alpha bounding boxes: 87-92% canvas fill, aspect 0.94-1.09. All four effectively fill their
canvas, so uniform `aspect-square` + `object-contain` + identical padding is correct — the
per-item padding normalisation considered in the plan was unnecessary and was not added.

## Follow-up worth deciding later

The `ENOEDA` watermark was tamed (`clamp(6rem,17vw,15rem)`, `opacity-60`) rather than removed, so
the strip stays readable. If the footer ever gains another block, the watermark should move out of
the flow entirely instead of being scaled down again.
