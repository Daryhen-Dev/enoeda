---
version: 1
slug: "app-dashboard-layout-tsx"
primary_target: "app/dashboard/layout.tsx"
related_targets: ["app/owner/layout.tsx","app/student/layout.tsx","components/attendance/attendance-sheet.tsx"]
---

# Surface brief: authenticated app shell (dashboard, owner, student)

Scope: every authenticated surface (`app/dashboard/**`, `app/owner/**`, `app/student/**`, auth pages later). Mode: Operate.

Audience and job: teachers on a phone at the mat (calendar -> attendance, conduct), admins on desktop (students, payments, schedules, staff). Single theme (no dark mode). Must stay usable with standard web controls (shadcn on @base-ui).

Staging: (1) foundation: tokens, font pipeline, shell (sidebar, header), single theme; (2) attendance sheet; (3) next screen by feedback. One PR per stage.

## Direction contract

THESIS: Closing work is the ritual. The app records the dojo's day like an ink ledger that gets sealed: open items are plain ink, finished items carry the red seal. Refuses the grey SaaS card grid with a decorative accent.

OWN-WORLD: Sumi blue-black ink owns the shell (sidebar rail, header text, primary buttons); cool paper ground (very light grey-blue) for work areas; an ink grey ramp for text, rules and borders; vermilion seal red reserved exclusively for done/active state (sealed attendance, validated payment, completed class, active nav item marker), never decoration. 1px hairline rules (lists read as ruled ledger lines, not card stacks), small radii (4-6px), tabular numerals for money and counts. Type: a clean workhorse interface sans (Geist) with heavy weights for titles; no serif and no display face (user-approved on the direction card, 2026-10-16). Real belt colors from `discipline_levels.color` are the only other chroma. Inactive/suspended entities drop to grey.

STORY: The user sees what is open today, acts, and watches it get sealed. Teacher: today's class -> attendance -> seal. Admin: what is overdue -> resolve -> seal.

FIRST VIEWPORT: Ink sidebar at left (desktop, collapsed to an icon rail between md and lg) / ink top bar with sheet nav (below md: the site header itself turns ink), branch name always visible in the shell, page title large and heavy in the header, work area on paper. Primary action in ink; done states in vermilion.

FORM: Ink and seal (shodo/hanko), candidate 3 of 7, seed:97f65a55ae679f12. Raises: orienteering map (red reserved for one meaning), character catalog (retired entities print grey), centre-rail setting (one-pixel ruling, small radii), datamatics (tabular numerals).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
