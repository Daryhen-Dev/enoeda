# Feature: regen-dojo-stories-media

## Goal

Regenerate the prerendered dojo-stories media (`public/media/dojo-stories/story-01..07.mp4` + `.webp` posters) from the current source videos (`assets/1..7.mp4`), and make the pipeline reproducible so future source swaps are a single command.

## Context (discovered during scan)

- Sources `assets/1..7.mp4` were replaced on 2026-09-27; published media dates from 2026-09-15 (commit 3f5ff50).
- Story 01 source is a genuinely different take (19.5s vs published 29.7s) — its poster shows old footage.
- Story 06 source is now 1080x1920 (published was 720x1280, same take).
- Stories 02-05, 07 are re-exports of the same takes.
- No build script existed (`scripts/` was empty); the old set was encoded ad-hoc with inconsistent resolutions (352x640 up to 720x1282), fps (30, 42, 19.7), and bitrates.

## Pipeline decision

Uniform web-optimized encode per story:

- Video: h264, yuv420p, CRF 24, preset medium, fps capped at 30, scaled to max height 1280 (even dims enforced by crop), `+faststart`.
- Audio: aac 128k (sources are stereo 44.1kHz; player supports sound).
- Poster: webp at the encoded video resolution, quality 80, frame at ~10% of duration (min 0.5s).
- Script: `scripts/build-dojo-stories.mjs` (Node, spawns ffprobe/ffmpeg), wired as `pnpm stories:build`.
- Script fails if a source is missing or if the count mismatches the catalog (`DOJO_STORIES`).

## Tasks

- [x] 1. Create reproducible build script (`scripts/build-dojo-stories.mjs`)
- [x] 2. Regenerate 7 mp4 + 7 webp into `public/media/dojo-stories/`
- [x] 3. Verify: ffprobe outputs, poster dims match video dims, `pnpm test` green
- [x] 4. Work-unit commit on `feat/dojo-stories-media-rebuild` (evidence recorded below)
- [x] 5. Retitle story-01 to "Detenerse nunca" (user-provided; catalog + component test aria-label), stories tests green
- [x] 6. Cache-bust media URLs with a per-story content hash (generated module + `images.localPatterns`), because Next serves static images as `immutable` in production

## Cache-busting work unit

- Root problem: replacing media under an unchanged public path leaves returning visitors on stale covers — the optimizer marks static sources `public, max-age=315360000, immutable` (`next/dist/server/image-optimizer.js`).
- `scripts/build-dojo-stories.mjs` writes `dojo-stories-media-version.ts`: per-story sha256(mp4)+sha256(webp), first 8 hex chars. Determinism verified: a full re-run reproduced byte-identical media (git clean) and an identical version module.
- Catalog derives `posterSrc`/`videoSrc` from that map, so an id without media fails loudly instead of shipping a stale URL.
- **Gotcha caught by live verification**: Next compares `localPatterns[].search` with strict string equality (not a pattern) and matches `pathname` with picomatch, not path-to-regexp. `search: "v=:version"` can never match `?v=58999131`. Correct config: glob pathname with `search` omitted — `{ pathname: "/media/dojo-stories/*.webp" }`.
- Guard test `dojo-stories-media-url.test.ts` asserts coverage with Next's own `hasLocalMatch`, so config drift fails in CI instead of 500ing the home page.
- Live check on :3001: home 200, all 7 versioned posters present in SSR HTML, optimizer returns 200 / 478x850 for `?v=58999131`.

## Follow-up decisions

- 2026-09-27: user confirmed the stale-looking covers were expected (stories 02-07 are the same takes; only story-01 footage changed). Story-01 title updated to "Detenerse nunca"; remaining titles unchanged by user decision.

## Non-goals

- No changes to the story player component or routes. The catalog was refactored only to derive versioned media URLs (task 6); titles are user-owned copy.
- No push / PR (user decides).
- Unrelated dirty working-tree files are left untouched.

## Verification results

- All 7 outputs: h264 / yuv420p / aac stereo, +faststart confirmed (moov before mdat).
- Poster webp dimensions match encoded video dimensions exactly for all 7.
- Stories + middleware test files: 24/24 passed (`dojo-stories-catalog`, `dojo-stories`, `dojo-story-viewer-state`, `middleware`). After cache-busting: 14/14 across the 4 files in `components/marketing/home/sections/`, `tsc --noEmit` clean.
- Full suite after cache-busting (parent tree): 674 passed / 6 failed. Clean branch checkout: 668 passed / 5 failed — the 5 are the pre-existing `main` failures above.
- Pre-existing failures: verified on a clean worktree checkout of this branch (no dirty files) — `lib/auth/branch-context.test.ts` (4) and `lib/domain/students/actions.test.ts` (1) fail on `main` itself (`3f5ff50`), independent of this work. Only `lib/prisma/client.test.ts` (1) is caused by the local uncommitted prisma regeneration. Out of scope here; the earlier note blaming the dirty tree for all six was wrong and is corrected by this line.
- Self-containment: dojo stories tests (14/14) and middleware tests (17/17) pass on the clean checkout, so the branch depends on no uncommitted source. Raw `tsc --noEmit` cannot run green in a fresh worktree because `next-env.d.ts` and `.next/` are gitignored Next typegen artifacts; this is environmental, not branch-introduced.
- Note: story-04 encoded at 718x1280 (even-dimension crop from 720x1282 source); story-06 downscaled from 1080x1920 to 720x1280.

## Evidence

- Commit: cbe2347 (media pipeline + regenerated media), c1b057d (story-01 retitle), 923d8fc (cache-busting).
