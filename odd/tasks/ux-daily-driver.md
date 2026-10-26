# Feature: ux-daily-driver

## Goal

Slices 5-8 of the usability evaluation: make the daily admin/teacher loops faster — a global student search,
a student directory that survives a phone, one status language on the calendar, and reversible bulk actions.

Stacked on `feat/ux-feedback-and-orientation` (PR #207), which is not merged yet.

## Specs

S1 — From any dashboard route, `Ctrl/Cmd+K` (and one visible search control in the header) opens a palette
that searches the students of the active branch by name or cédula, lists at most 8 matches with their status,
moves the highlight with the arrow keys, opens the highlighted student on `Enter` keeping the active branch,
and closes on `Escape` without navigating. A search with no matches says so in Spanish; a failed search never
closes the palette.

S2 — In the students directory every row keeps its actions reachable from a single "Acciones" menu, and below
`md` each student renders as a stacked card (name, status, disciplines, due date) instead of the horizontally
scrolling table. Row → detail stays one tap.

S3 — The calendar session block uses only the semantic tokens from `DESIGN.md` (no palette utilities, no
`dark:` variants) and shares one status vocabulary with the agenda and the detail panels: scheduled, attended
and suspended read the same color and the same word everywhere.

S4 — Reversible administrative actions offer an undo in the success toast (deactivate/reactivate student,
suspend/reinstate class), and the students directory can select several rows and deactivate them in one action
with the same confirmation and undo as the single-row path.

## Tasks

- [x] T1 — Student search palette with shortcut and header control (S1), route: inline, commit: TBD
- [x] T2 — Students directory: row actions menu + mobile cards (S2), route: delegated (gentle-ai-worker), commit: TBD
- [x] T3 — Calendar session block on semantic tokens and one status language (S3), route: delegated (gentle-ai-worker), commit: TBD
- [x] T4 — Undo for reversible actions + bulk deactivate (S4), route: inline (undo) + delegated (bulk), commit: b1f84d2 + TBD
- [x] T5 — Docs and close-out verification, route: inline, commit: TBD

## Evidence

- `49997ea` — S1: `StudentSearchPalette` in the dashboard layout (debounced search over active and inactive
  students of the branch, arrow keys, Enter keeps the branch, Escape closes), the `enoeda:open-student-search`
  event, and `StudentSearchTrigger` in the header. The search state is derived from the last answered query, so
  the effect never sets state synchronously (repo lint rule).
- `cad3dbe` — S2, delegated to `gentle-ai-worker`: `StudentRowActions` (one Acciones menu per row, dialogs
  rendered outside the popup through an additive controlled mode on five dialogs), `StudentCard` for phones, and
  the `md` split in `student-list.tsx`. Existing dialog tests untouched.
- `7b8a229` — S3, delegated: `session-block.tsx` moved from 51 palette utilities and 35 `dark:` variants to the
  design tokens and the shared `buttonVariants`/`Badge`; one status vocabulary (pending pill, seal for attended,
  retired grey for suspended), the compact month dots on `seal`/`destructive`, and three `COMPACT_STATUS_*`
  message keys removed as orphaned. Pinned by `session-block.tokens.test.tsx`.
- `b1f84d2` — S4 undo half: `showUndoableAction` + `UNDO_MESSAGES`, wired to student deactivate ↔ reactivate and
  class suspend → reinstate (a reinstatement re-suspends with the session's recorded category; with no recorded
  category it keeps the plain toast instead of guessing).
- `b6115cf` — S4 bulk half, delegated: `deactivateStudents` (1-50 ids, one transaction, all-or-nothing, same
  branch-context guard), `StudentSelectionBar`, `BulkDeactivateDialog`, checkboxes on rows and cards, selection
  cleared when the visible set changes.
- T5 — DESIGN.md documents the command palette, row actions, selection bar and the undo affordance.

### Visual check (ego-browser, 2026-10-26)

Temporary preview route with synthetic data through the real components (deleted before the commit; the real
dashboard needs Supabase credentials this session does not have), served by `next dev` on :3020:
desktop 1440, mobile 390, the palette in its empty and results states, the row actions menu open, and the three
class-block states. No horizontal overflow at 390 or 1440 and no console errors.

Two findings, both fixed here:
1. The palette merged the active and inactive queries without deduplicating: the same student rendered twice and
   two rows shared one React key. The merge is now id-keyed (active wins) and a test pins it.
2. "Desactivar" rendered in the row menu like any other item; it now uses the menu's destructive variant so the
   carmine vocabulary from DESIGN.md holds inside menus too.

Left as observations, not changed: the mobile card stacks four label/value rows (name, estado, disciplinas,
vencimiento) which is tall for a 40-student directory, and the card header is the only "ver ficha" target with
no chevron or underline, so it relies on the Actions menu for discoverability.

### Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on every touched file: clean. Pre-existing and untouched: `lib/domain/students/actions.test.ts:56`
  (`(fn: Function)`, `@typescript-eslint/no-unsafe-function-type`) fails lint on `main` as well; the file is not
  part of this branch.
- `pnpm build`: exit 0.
- `pnpm vitest run`: 1516 passed, 1 skipped, 1 failed — the only failure is issue #208
  (`get-sessions-resolver` asserting a strictly future Monday), which reproduces on `main` with the same clock.
- Not verified: no authenticated browser pass and no visual check of the palette, the mobile card list, the
  selection bar or the token-refactored calendar. The base-ui menu popup cannot be opened in jsdom in this repo
  (leaks floating-ui timers and kills the worker), so `student-row-actions.test.tsx` drives a stateful double of
  the dropdown; the real trigger is exercised by `student-card.test.tsx`.

## Log

L1 (verbatim user request): "revisa porque esta caido engram es prioridad eso, luego vamos con 1 lo dejamos como issue aparte y continuamos con el resto"

L2 (context): "1" refers to the Monday-only failing test, now tracked as issue #208 and explicitly out of scope here.

L3 (decision, S1): the palette lives in the dashboard layout and listens for a `enoeda:open-student-search`
window event plus `Ctrl/Cmd+K`; the header only renders a plain control that dispatches the event, so the header
never imports a server action and its existing tests keep their light mocking.

L4 (decision, S4 undo): one shared `showUndoableAction` in `lib/notifications/undo-toast.ts` owns the 10 s toast
with the "Deshacer" action and the outcome copy, and each caller passes the inverse server action. Wired to
student deactivate ↔ reactivate and class suspend → reinstate. Undoing a reinstatement re-suspends with the
session's own recorded category and reason; when the session has no recorded category there is no faithful
inverse, so the block keeps the plain success toast instead of guessing one.
