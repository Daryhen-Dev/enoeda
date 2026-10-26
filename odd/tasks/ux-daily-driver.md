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
- [ ] T4 — Undo for reversible actions + bulk deactivate (S4), route: inline, commit: TBD
- [ ] T5 — Docs and close-out verification, route: inline, commit: TBD

## Log

L1 (verbatim user request): "revisa porque esta caido engram es prioridad eso, luego vamos con 1 lo dejamos como issue aparte y continuamos con el resto"

L2 (context): "1" refers to the Monday-only failing test, now tracked as issue #208 and explicitly out of scope here.

L3 (decision, S1): the palette lives in the dashboard layout and listens for a `enoeda:open-student-search`
window event plus `Ctrl/Cmd+K`; the header only renders a plain control that dispatches the event, so the header
never imports a server action and its existing tests keep their light mocking.
