# Feature: app-visual-foundation

## Goal

Stage 1 of the authenticated-app redesign: give the app (dashboard, owner, student, auth pages via shared
tokens) its own visual identity — "Ink and seal" — by replacing the greyscale shadcn defaults with the
committed palette, fixing the font pipeline, moving to a single light theme, and restyling the shell
(sidebar, header, student layout). Later stages redesign screens one by one (stage 2: attendance sheet).

## Decisions (user, 2026-10-16)

- Daily users: teachers on phones at the mat, admins on desktop.
- New identity for the app, not the marketing one. Direction chosen via Impeccable: "Tinta y sello"
  (seed 58bc0122, candidate 3). Contract: `.impeccable/surfaces/app-dashboard-layout-tsx.md`.
- Product record: `PRODUCT.md`. Build path: code-led (no image generation available).
- Single theme: remove the light/dark toggle and `next-themes`.
- Staging: one PR per stage; foundation + attendance first.

## Design tokens (stage 1)

- Sumi ink shell (sidebar, primary buttons), cool paper ground, white work panels, ink grey ramp,
  1px hairlines, radius 6px, tabular numerals in tables.
- `--seal` vermilion only for done/active (active nav icon, sealed states in later stages).
- `--destructive` deep carmine, kept distinct from the seal (risk: both red-family; danger always pairs
  with icon + text, seal always with the seal mark).
- Keep `@custom-variant dark (&:is(.dark *))` so leftover `dark:` utilities stay inert instead of falling
  back to `prefers-color-scheme`.

## Tasks

- [x] 1. Tokens, font pipeline, single theme, shell restyle (sidebar, headers, student layout)
- [x] 2. Verify: tests, tsc, eslint, build, screenshots (login, marketing unaffected, shell preview)
- [x] 3. Work-unit commit (push/PR pending user decision)
- [ ] 4. Impeccable finish review + DESIGN.md — deferred to end of stage 2, when the seal move renders in a real screen

## Evidence

- Implementation delegated to gentle-ai-worker; parent fixed the mobile header (two-row content overflowed
  the fixed 54px height: now `min-h` + `py-2` below `sm`, exact `h-(--header-height)` from `sm`).
- Font pipeline bug fixed: `--font-sans` was self-referential, so the app rendered in the UA default font.
  Now Geist. Marketing kept byte-for-byte computed fonts via `[data-marketing-page] { font-family: initial }`
  (verified in browser: hero Bebas Neue, body/nav Archivo Narrow, unstyled root Times New Roman as before).
- `next-themes`, ThemeProvider and ThemeToggle removed; `.dark` block deleted; `dark:` variant kept inert.
- Sidebar variant `inset` -> `sidebar` (ink rail on paper canvas; inset painted the whole canvas ink).
- Contrast (WCAG): fg/bg 16.5:1, muted-fg on bg 6.35, on white 6.82, on muted 5.81; sidebar fg 12.9;
  primary fg 14.9; destructive on white 6.1. Seal on white 4.34 / white on seal 4.15 -> seal is for
  icons and large state marks only, never small text.
- Checks: full `pnpm test` 129 files / 1338 passed, 1 skipped, 0 failed; `tsc --noEmit` clean; eslint clean;
  `pnpm build` exit 0 (a stale gitignored `.next/dev` type cache from a temp preview route had to be removed).
- Visual: temporary preview route rendering the real shell (deleted afterwards). Desktop 1440x900 and mobile
  390x844: no horizontal overflow, header 54px desktop, mobile header children fully inside; mobile nav sheet
  renders the ink rail. Impeccable detector: 0 findings on touched files.
- Known follow-ups: mobile sidebar sheet is 75% wide (`SheetContent` `w-3/4` outranks `--sidebar-width`);
  active-nav seal tint not observed in a browser (needs an authenticated route); `next dev` generates
  `AGENTS.md`/`CLAUDE.md` (deleted, not committed).

## Non-goals

- No screen-level redesign in this stage (attendance, calendar, payments come later).
- No copy changes; no marketing changes.
