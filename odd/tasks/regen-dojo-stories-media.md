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

- Video: h264, yuv420p, CRF 26, preset slow, fps capped at 30, scaled to max height 1280 (even dims), `+faststart`.
- Audio: aac 128k (sources are stereo 44.1kHz; player supports sound).
- Poster: webp at the encoded video resolution, quality 80, frame at ~10% of duration (min 0.5s).
- Script: `scripts/build-dojo-stories.mjs` (Node, spawns ffprobe/ffmpeg), wired as `pnpm stories:build`.
- Script fails if a source is missing or if the count mismatches the catalog (`DOJO_STORIES`).

## Tasks

- [x] 1. Create reproducible build script (`scripts/build-dojo-stories.mjs`)
- [x] 2. Regenerate 7 mp4 + 7 webp into `public/media/dojo-stories/`
- [x] 3. Verify: ffprobe outputs, poster dims match video dims, `pnpm test` green
- [x] 4. Work-unit commit on `feat/dojo-stories-media-rebuild` (evidence recorded below)

## Non-goals

- No changes to component code, catalog entries, titles, or routes.
- No push / PR (user decides).
- Unrelated dirty working-tree files are left untouched.

## Verification results

- All 7 outputs: h264 / yuv420p / aac stereo, +faststart confirmed (moov before mdat).
- Poster webp dimensions match encoded video dimensions exactly for all 7.
- Stories + middleware test files: 24/24 passed (`dojo-stories-catalog`, `dojo-stories`, `dojo-story-viewer-state`, `middleware`).
- Pre-existing failures (6 tests in `lib/auth/branch-context`, `lib/domain/students/actions`, `lib/prisma/client`) come from unrelated uncommitted work in the dirty tree; out of scope.
- Note: story-04 encoded at 718x1280 (even-dimension crop from 720x1282 source); story-06 downscaled from 1080x1920 to 720x1280.

## Evidence

- Commit: 6c3ee37 (feat/dojo-stories-media-rebuild)
