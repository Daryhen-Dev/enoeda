# Feature: kickboxing-page

## Goal

New public marketing page `/kickboxing` inside `app/(marketing)` that tells the history of
kickboxing with an intriguing editorial voice (not a verbatim copy of the supplied guide),
embeds the training video as a story-style "Historia", and shows the students' photos,
keeping the existing marketing visual system (Bebas Neue / Archivo Narrow, navy surface,
red accent, hard borders and offset shadows).

## Decisions

- Route: `app/(marketing)/kickboxing/page.tsx`; component in `components/marketing/kickboxing/`.
- Copy: neutral Ecuadorian Spanish with "tú" (no voseo), paraphrased from the user's guide.
- Media: video published as `public/media/kickboxing/entrenamiento.mp4` (source already h264/aac
  with faststart, 576x1024, 25.7s, copied as-is) + `entrenamiento.webp` poster (frame at 2.5s).
  Photos imported statically from `assets/kickboxing/kick1..5.jpeg`.
- Navigation: add `Kickboxing` -> `/kickboxing` after `El camino`.
- No schedule claims (kickboxing-specific schedule not confirmed in current data); CTA goes to
  WhatsApp with a kickboxing message and to `/#sedes`.

## Tasks

- [x] 1. Page: media, route, component, CSS module, focused test
- [x] 2. Navigation entry + navigation test
- [x] 3. Verify: vitest, tsc, eslint, build
- [x] 4. Make `/kickboxing` public (`PUBLIC_PATHS`) + middleware test

## Evidence

- Implementation delegated to gentle-ai-worker; parent fixed hero top padding (fixed header overlap) and `#historia` scroll margin.
- Verifier caught that `/kickboxing` 307-redirected to `/login`: the route was missing from
  `lib/auth/authorize.ts` `PUBLIC_PATHS`. Added it next to `/el-camino`, with a middleware test.
- Checks: vitest `middleware.test.ts lib/auth components/marketing` 21 files / 166 tests passed;
  `tsc --noEmit` clean; eslint clean on touched files; `pnpm build` lists `○ /kickboxing`.
- Runtime (`pnpm start`): `/kickboxing` 200 with no redirect; mp4 200 + Range 206; webp 200;
  `/_next/image` for kick3 200. Playwright (local chromium-1243): no horizontal overflow at
  390x844 and 1440x900; h1 sits 126px / 162px below the fixed header.
- Note: lazy gallery images render blank in full-page screenshots (the footer logos do too); not inspected in a real scroll.

- Commit: `60b2e8a feat(marketing): add public kickboxing history page` on `feat/kickboxing-page`.

## Non-goals

- No changes to the home dojo-stories player.
- No push / PR (user decides).

## Follow-up: remove origin timeline and quote band (2026-10-16)

- User request: drop the "El origen" timeline and the red "Si reconoces de dónde viene un peleador..." band.
- Hero "VER LA HISTORIA" now targets `#historia` (training video); section backgrounds re-alternated
  (surface/muted) and style cards switched to surface fill to keep contrast on the muted band.
- Checks: vitest `components/marketing` + `middleware.test.ts` 10 files / 53 tests passed; tsc and eslint clean;
  `pnpm build` `○ /kickboxing`; served HTML has no origin/quote text; Playwright: no horizontal overflow at
  390x844 / 1440x900, 6 sections strictly alternate, all 4 gallery images loaded.
