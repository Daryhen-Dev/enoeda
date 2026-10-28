---
name: ENOEDA Dojo — Tinta y sello
description: Ink-ledger visual system for the authenticated ENOEDA Dojo app — sumi ink shell, cool paper ground, vermilion seal reserved for done/active state.
colors:
  paper: "oklch(0.975 0.006 250)"
  panel-white: "oklch(1 0 0)"
  mist: "oklch(0.945 0.01 255)"
  hairline: "oklch(0.89 0.012 255)"
  sumi-ink: "oklch(0.21 0.03 262)"
  ink-primary: "oklch(0.26 0.045 262)"
  paper-bright: "oklch(0.985 0.004 250)"
  ink-muted: "oklch(0.47 0.025 260)"
  ring-ink: "oklch(0.5 0.06 262)"
  seal-vermilion: "oklch(0.6 0.2 33)"
  destructive-carmine: "oklch(0.52 0.19 18)"
  sidebar-sumi: "oklch(0.22 0.035 262)"
  sidebar-ink: "oklch(0.9 0.012 255)"
  sidebar-ink-hover: "oklch(0.29 0.04 262)"
  sidebar-hairline: "oklch(1 0 0 / 10%)"
  chart-seal: "oklch(0.6 0.2 33)"
  chart-ink-soft: "oklch(0.45 0.09 262)"
  chart-slate: "oklch(0.55 0.07 200)"
  chart-ochre: "oklch(0.72 0.12 80)"
  chart-grey: "oklch(0.6 0.02 260)"
typography:
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  brand:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4667
    letterSpacing: "normal"
  meta:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.08em"
rounded:
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.525rem"
  pill: "0.975rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  badge-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
    padding: "0 0.5rem"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
    padding: "0 0.5rem"
  checkbox:
    backgroundColor: "transparent"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.lg}"
    size: "1rem"
  checkbox-checked:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.lg}"
    size: "1rem"
---

# Design System: ENOEDA Dojo — Tinta y sello

## Overview

**Creative North Star: "Tinta y sello" — the app records the dojo's day like an ink ledger that gets sealed.**

The authenticated app is a working ledger. Sumi blue-black ink owns the shell — the sidebar rail, the header text, the primary buttons — and cool paper carries the work area. Everything that needs doing is plain ink; everything that is done carries the red seal. The vermilion stamp is the single emotional gesture in an otherwise quiet, ruled, workmanlike system: closing work is the ritual, and the interface celebrates nothing else. It refuses the grey SaaS card grid with a decorative accent — structure comes from hairline rules, not from boxes and tints.

Density is compact and ledger-like (2rem controls, 1px rules, tabular numerals for money and counts), built for a teacher on a phone at the mat and an admin on desktop. Type is a single workhorse sans (Geist) doing all the work through weight and size — no serif, no display face (user-approved on the direction card, 2026-10-16). There is exactly one theme: a single light theme, with the class-based `dark:` variant intentionally kept inert.

**Scope note:** the public marketing site (`app/(marketing)`, `components/marketing/**`, `--marketing-*` tokens, Bebas Neue / Archivo Narrow) is a separate, older identity and is out of scope for this document.

**Key Characteristics:**

- Ink shell, paper ground, white work panels — three flat planes separated by 1px hairlines.
- Vermilion seal red (`--seal`) reserved exclusively for done/active state; never decoration.
- Lists read as ruled ledger lines (1px rule in every state), never card stacks.
- Tabular numerals for money and counts; compact 2rem control height.
- Belt colors from `discipline_levels.color` are the only other chroma, always as a hairline-bordered swatch.
- Type root is split by surface: the app runs 16px; marketing keeps 18px via `html:has([data-marketing-page])`.
- One authored motion: a reduced-motion-aware one-shot seal stamp (220ms expo-out).
- Browser surfaces are themed: selection, caret, accent color, scrollbar all speak ink.

## Colors

A near-monochrome ink ramp on cool blue-tinted paper, with one vermilion accent that means "done" and nothing else. All values are OKLCH, matching the project's `:root` tokens in `app/globals.css`.

### Primary
- **Sumi Ink** (`oklch(0.21 0.03 262)` / `oklch(0.26 0.045 262)`): the voice of the system. Foreground text, primary buttons, checked checkboxes, focused rings. Slightly blue-leaning black, like ink on a brush. Contrast on paper: 16.51:1.
- **Shell Ink** (`oklch(0.22 0.035 262)`): the sidebar plane, a half-step deeper than text ink so the rail reads as a surface, not a color block. Hover state lifts to `oklch(0.29 0.04 262)`; its 10%-white hairline separates it from the paper.

### Secondary
- **Seal Vermilion** (`oklch(0.6 0.2 33)`): the signature. Appears only as done/active state — the sealed attendance, the active nav icon (`--sidebar-primary`), the post-save stamp overlay. Contrast on white: 4.34:1; white on seal: 4.15:1 — which is why it is never used for small text.

### Tertiary
- **Destructive Carmine** (`oklch(0.52 0.19 18)`): a deeper, colder red, kept clearly distinct from the seal. Errors and destructive actions only, on a 10% tint of itself (`destructive/10`) rather than solid fills. Contrast on white: 6.10:1.

### Neutral
- **Cool Paper** (`oklch(0.975 0.006 250)`): the ground every work area sits on.
- **Panel White** (`oklch(1 0 0)`): cards, popovers, sheets — the work surface.
- **Mist** (`oklch(0.945 0.01 255)`): secondary/muted/accent fills — hover states, quiet badges, absent-row tints (at 60%).
- **Hairline** (`oklch(0.89 0.012 255)`): every border and input stroke on paper.
- **Muted Ink** (`oklch(0.47 0.025 260)`): secondary text. 6.35:1 on paper, 6.82:1 on white, 5.81:1 on mist.
- **Paper Bright** (`oklch(0.985 0.004 250)`): text on ink surfaces (primary buttons, sidebar). 14.92:1 on primary ink, 12.87:1 on the shell.
- **Ring Ink** (`oklch(0.5 0.06 262)`): focus rings, at 50% for the standard 3px ring.
- **Chart series** (`oklch(0.6 0.2 33)`, `oklch(0.45 0.09 262)`, `oklch(0.55 0.07 200)`, `oklch(0.72 0.12 80)`, `oklch(0.6 0.02 260)`): reserved palette for any future data visualization; the seal leads the series.

### Named Rules

**The Seal Rule.** Vermilion is reserved exclusively for done/active state. Never decoration, never a second accent, never small text (its contrast, 4.15–4.34:1, forbids it). On the ink shell it appears only as the active nav icon.

**The One Chroma Rule.** Real belt colors from `discipline_levels.color` are the only other chroma in the system, and they always render as a small hairline-bordered swatch (so a white belt stays visible on paper). No arbitrary color values anywhere else.

**The Print-Grey Rule.** Retired or inactive entities print grey — muted ink, no color — like struck entries in a ledger.

**The No-Color-Only Rule.** Absence and state are never color alone: an absent row gets a bordered text marker pill ("Ausente"), not just a tint.

## Typography

**Display Font:** none — this system has no display face.
**Body Font:** Geist (variable, via `--font-geist-sans`), sans-serif fallback.
**Label/Mono Font:** Geist Mono is loaded (`--font-geist-mono`) but is not load-bearing; use it only where monospace data genuinely helps.

**Character:** one workhorse sans doing everything through weight and size. Titles are heavy and slightly tightened; body text is quiet and compact. The personality comes from the ledger ruling and the seal, not from the letterforms.

### Hierarchy
- **Title** (600, `1.25rem` mobile → `1.5rem` sm, `-0.01em` tracking): page titles in the header and sheet titles. The largest text in the app.
- **Brand** (600, `1rem`): the "Enoeda Dojo" wordmark beside the emblem in the sidebar.
- **Body** (400–500, `0.9375rem` — 15px at the 16px app root, via the app-scoped `text-sm` step — ≈1.47 line-height): all UI text, list rows, form labels.
- **Meta** (500, `0.75rem`): timestamps, level names, notes, source badges; sidebar group labels additionally uppercase with `0.08em` tracking.
- **Ledger figures**: all money and counts in `tabular-nums` (applied globally to tables, and to count lines like "12/15 presentes").

### Named Rules

**The Workhorse Rule.** Geist is the only family; heavy title weights carry the hierarchy. No serif, no display face — user-approved, 2026-10-16.

**The Ledger Rule.** Money and counts are always tabular numerals, so columns of figures align like a ruled ledger.

## Layout

The shell is a fixed spatial contract: **ink sidebar at left on desktop, ink top bar with sheet navigation on mobile**. Below `md` (768px) the site header itself is the ink top bar (`bg-sidebar`, sidebar ink text, brand emblem before the page title) and the rail opens as a sheet; from `md` up the header sits on paper next to the ink rail. The brand emblem and name sit at the top of the rail; the header carries the page title (large and heavy) on the left and the branch switcher plus user name on the right, separated from the work area by a 1px bottom hairline. The work area is paper. The student area (`/student`) uses the same language in a centered single column (`max-w-4xl`) with an ink top bar instead of a rail.

Rhythm: sections breathe at `1.5rem` gaps; form rows and list internals at `0.375–0.75rem`; page gutters `1rem` (mobile) to `1.5rem` (desktop). Controls are compact — `2rem` height by default, `1.75rem` (`sm`) and `1.5rem` (`xs`) for dense toolbars. Full-width primary actions (`min-h-3rem`) anchor mobile forms. Long content sheets take at least 40% of the viewport on desktop; on mobile they take the full width or become bottom sheets.

Sticky elements: the attendance save bar sticks to the bottom of its scroll area with a soft upward lift shadow and a popover-white ground. Responsive behavior is Tailwind's default (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px). The overview panels stack until `xl`, where they split 7/5; at `lg` the expanded rail would leave each panel too narrow for names. The rail is a sheet below `md`, starts collapsed to a 48px icon rail between `md` and `lg` (expandable with the trigger), and is expanded from `lg`, where the user's toggle owns its state. In icon mode the brand shows only the emblem, menu items show tooltips, and logout is reached by expanding the rail.

**Type root split.** The authenticated app runs a 16px root (`html { font-size: 16px }`); the marketing site keeps its historical 18px root through `html:has([data-marketing-page])`. The readable-body override (`--text-sm: 0.9375rem`) is scoped app-only via `html:not(:has([data-marketing-page]))` and must never leak into the marketing root, which also uses `text-sm`.

## Elevation & Depth

Depth is built by ruling, not by stacking: three flat planes (ink shell, paper ground, white panel) separated by 1px hairlines. Shadows are rare and always soft, appearing only where a surface genuinely floats above the page.

### Shadow Vocabulary
- **Sticky action lift** (`0 -8px 16px -12px color-mix(in oklch, var(--foreground) 25%, transparent)`): a soft upward cue under sticky bottom action bars so content scrolls visibly beneath them.
- **Floating panel lift** (Tailwind `shadow-lg`): side sheets and popovers only.

### Named Rules

**The Hairline Rule.** 1px rules structure the page. Lists read as ruled ledger lines — every row carries its bottom rule in every state; they never become a stack of bordered cards.

**The Soft Shadow Rule.** Shadows are soft, single-direction lift cues for floating surfaces only. No hard offset shadows, ever.

## Shapes

Small, precise radii anchored at **6px** (`--radius: 0.375rem`), derived down for dense controls (`sm` ≈ 3.6px, `md` ≈ 4.8px) and up for panels (`xl` ≈ 8.4px). Badges are near-pills (`rounded-4xl`, ≈ 15.6px on a 20px height); the belt swatch is a full-round vertical strip. Borders are 1px hairlines everywhere on paper; the ink shell separates from paper with a 10%-white hairline instead. Two recurring silhouettes: the bordered text marker pill for state ("Ausente"), and the seal — a rotated (−8°) SVG composition of a ring, an inner rounded square and a bold check, pure geometry with no illustration (2.5 / 1.5 / 3.5px strokes on the 56-unit hanko at 44px+; redrawn on a 24-unit grid for the 24px ledger seal, see Ledger seal).

## Components

### Buttons
- **Shape:** gently rounded rectangles (6px radius), `2rem` tall by default.
- **Primary:** sumi ink fill, paper-bright text (`bg-primary`, `px-2.5`); hover deepens via 80% opacity; active presses down 1px.
- **Outline:** paper fill, hairline border; hover tints to mist. The workhorse for secondary actions ("Marcar todos presentes").
- **Secondary:** mist fill, ink text — used for quiet in-row actions like "Cobrar clase".
- **Ghost:** transparent, mist on hover — used for inline toggles like the note button.
- **Destructive:** a 10% carmine tint with carmine text (no solid fill); hover doubles the tint.
- **Focus:** 3px ring at 50% ring ink; invalid state rings carmine.
- **Sizes:** `xs` (1.5rem), `sm` (1.75rem), default (2rem), `lg` (2.25rem); icon-only square variants for each.

### Badges
- **Style:** near-pill (`h-5`, `px-2`), `text-xs` medium.
- **Variants:** `secondary` (mist fill) for source labels like "Por clase"; `outline` (hairline border) for read-only history rows; no colored status badges — state meaning lives in the ledger row, not in a tinted chip.

### Checkbox
- **Style:** 16px square, 6px radius, hairline border on paper.
- **Checked:** solid ink fill, paper-bright check; the tap target extends invisibly beyond the box for the teacher's thumb.
- **Attendance semantics:** checked = present; an unchecked row drops to the 60%-mist absent tint with its bordered "Ausente" marker pill.

### Inputs / Fields
- **Style:** hairline stroke (`--input`), transparent fill, 6px radius.
- **Focus:** 3px ring at 50% ring ink, no glow.
- **Error:** a bordered alert block — 50% carmine border on a 10% carmine tint with carmine text (`role="alert"`), never a toast alone.

### Navigation
- **Sidebar:** ink rail; items are quiet paper-bright rows with lucide icons; hover and active states lift to the lighter shell ink; the **active item's icon alone turns seal vermilion** — the seal's only appearance on the shell. Group labels are uppercase, tracked (`0.08em`), muted. Collapses to icons; mobile uses the ink top bar plus sheets.
- **Header:** hairline bottom border on paper; page title `text-lg/xl` semibold with `-0.01em` tracking; branch switcher is a native select on desktop and a bottom-sheet drawer on mobile, always visible (one branch, one truth).
- **Breadcrumb:** a nested route (Pagos › Validación mensual, Pagos › Precios) shows its parent section as a `text-xs` muted link with a `3`-wide chevron before the page title, `md` and up; the title itself stays the current section name, and its link keeps the active branch. Top-level routes render the bare title, and the student detail keeps its own back arrow instead of repeating "Estudiantes".
- **Section sub-nav:** a section with sibling screens (Pagos: Resumen · Validar pagos · Precios) renders one `nav` of ghost links under the heading. The current tab takes `bg-muted` + `text-foreground` and `aria-current="page"` — the seal never marks navigation.
- **Loading and failure:** every dashboard segment ships its own loading boundary shaped like its destination (panel, table, detail, calendar grid) and the shell ships one error boundary with a `Reintentar` action. Placeholder boxes are `aria-hidden="true"`; the screen announces once through a `role="status"` line.
- **Command palette (`Ctrl/Cmd+K`):** one paper panel pinned near the top of the viewport (never centered), with a search field carrying the magnifier at its leading edge, an ink-highlighted option row (`bg-muted`), and a hairline footer with the keyboard contract. The header control shows only the magnifier below `lg` so the ink bar never crowds; it dispatches an event and owns no palette state.

### Row actions
- **One menu per row:** a ghost `MoreHorizontalIcon` button whose accessible name names the record ("Acciones de …"). Items are sentences of what they do ("Pago mensual · Karate", "Reactivar"), never a bare "ver más". The dialog a row opens is rendered by the row, outside the popup, so a menu never nests a dialog — and a phone never scrolls sideways to reach an action.
- **Mobile rows:** below `md` a record is a stacked card (`bg-card`, hairline border, name over muted meta), not a table. The card header is the one-tap target for the record's page; the menu carries the rest.
- **Selection bar:** while a selection exists, one hairline bar above the list states the count and offers the batch action plus "Limpiar selección"; the batch confirmation names the records (first three, then "y N más"). Selection exists only for a manager on the active tab and is cleared whenever the visible set changes.

- **Belt identity:** the students directory (table row and mobile card) leads each record with the same hairline belt swatch the attendance ledger uses — one per active discipline with a recorded level, never an empty hairline, with the level name and its discipline exposed to assistive tech. A student is recognized by belt color without spending a column on it.
- **No status echo:** the directory table never repeats state it already shows elsewhere. The active/history tab is `is_active`, so there is no "Estado" column; `activation_status` appears only as a "Pendiente de activación" badge while the record is still pending, and an activated record prints nothing.

### Filtered records list
- **Records lead, actions follow:** a records page (Conducta) opens with the list, never with a form. One `Registrar` button sits at the heading's trailing edge and opens a side sheet hosting the create flow; a successful registration closes the sheet so the refreshed list is immediately visible.
- **One filter, named after the person:** when the only useful filter is the student, the filter is one labelled search at the head of the list, with the same debounce, keyboard contract and status lines as every other student picker. Picking someone retitles the list after them ("Registros de …") and one visible **Quitar filtro** control returns to the branch's latest records. No filter chips, no date range, no second search box, and the search never doubles as the create form's step 1.
- **Read-only rows:** this list carries no per-row actions. The row links to the student and the record's actions (mark paid, void) stay on the student detail page, so filtering can never be mistaken for editing.

### Undo
- A reversible administrative action (deactivate/reactivate a student, suspend/reinstate a class) confirms itself with a toast that carries a **Deshacer** action for ten seconds. The undo calls the inverse action and reports whether it actually landed; it never silently claims success. Irreversible work keeps the explicit "no se puede deshacer" confirmation instead.

### Ledger list (signature)
The attendance sheet is the system's defining pattern: a `border-t`-opened list of rows, each closed by a 1px `border-b` in every state — present, absent, history — never cards. Each row leads with the belt swatch (hairline-bordered `2.5 × 5.5` strip filled from `discipline_levels.color`, level name in visually-hidden text), the student name at `text-sm`, the checkbox always in the same position so nothing jumps between states, and a meta line (outside the tap target) holding source badges, the absent marker pill, note previews, and per-row actions. History rows are visually retired: muted ink, `outline` badge, no interaction. A full-width sticky save bar with the soft lift shadow anchors the flow; on save, the seal stamps.

### Ledger panel (signature)
The dashboard overview's work areas generalize the ledger list into a white panel: a `bg-card` plane framed by 1px hairlines, with a hairline-separated header (panel title at `text-lg` semibold, `-0.01em`), ruled rows each closed by a 1px `border-b` in every state, and a hairline-separated footer. Each row leads with its name and a muted meta line; the **state cell sits at the trailing edge** — the vermilion seal for done work, an outline pill for pending work, muted grey for suspended rows. Actions are **named by what they do** ("Tomar asistencia", "Validar pagos") and live in the row or the footer, never as bare "ver más" links; a group sliced at five rows closes with its own ruled "Ver los N" line pointing at the full table.

### AttendanceSeal (signature)
A vermilion hanko-style stamp: SVG ring + inner rounded square + bold check, rotated −8°, at 44px inline or 96px in the post-save overlay (over a 60% paper scrim). The visible label ("Asistencia registrada") renders beside the stamp in ink, never inside the ring. `role="img"` with an aria-label carries the meaning exactly once. Its only animation is the one-shot stamp: 220ms expo-out from `scale(1.25)`, skipped entirely under `prefers-reduced-motion`.

### Ledger seal (small)
The 24px seal on ledger rows (`SealMark`) is drawn on its own 24-unit grid instead of scaling the 56-unit hanko down (scaled, the hanko's inner square falls below a pixel): a ring (r 10.875, stroke 1.75), an inner rounded square (13 units, rx 2, stroke 1) and a bold check (stroke 2, round caps and joins), rotated −8°, in `--seal`, `role="img"` with the same aria-label. Every stroke is at least one device pixel, so it keeps the stamp silhouette instead of reading as a generic check-circle. Use the full hanko from 44px up and the ledger seal below.

### Browser surfaces
Selection (ink fill, paper-bright text), caret, form accent color, and scrollbar are all themed to the ink palette via `html:not(:has([data-marketing-page]))`, so even native controls speak the system. Tables default to tabular numerals.

## Do's and Don'ts

### Do:
- **Do** reserve seal vermilion for done/active state only: active nav icon, sealed attendance, the post-save stamp. Its rarity is the point.
- **Do** structure lists with 1px hairlines in every row state — ledger lines, not card stacks.
- **Do** set all money and counts in tabular numerals.
- **Do** render belt colors from `discipline_levels.color` as hairline-bordered swatches, with the level name available to screen readers.
- **Do** print retired/inactive entities in muted ink with outline badges.
- **Do** pair every state color with a text or geometric marker (absent tint + "Ausente" pill).
- **Do** keep the single light theme; leave the `dark:` variant inert rather than deleting it, so leftover utilities stay harmless.
- **Do** keep controls compact (`2rem` default) and the seal stamp the only authored motion.

### Don't:
- **Don't** use the seal vermilion as decoration, for hover states, or for text below ~14px (contrast 4.15–4.34:1 forbids it).
- **Don't** introduce a second accent or arbitrary colors — belt colors are the only other chroma.
- **Don't** stack bordered cards where a ruled list will do; don't add tints to differentiate list states beyond the absent row's 60% mist.
- **Don't** add a dark theme or honor `prefers-color-scheme` in the authenticated app.
- **Don't** use hard offset shadows or add new authored animations.
- **Don't** put text inside the seal ring; the label renders beside it.
- **Don't** let the app-only `--text-sm` override (`0.9375rem`) leak into the marketing root — marketing keeps its own 18px root and its own `text-sm`.

**Not canonized / known defects:** none open on the authenticated app. (#7, the dashboard stat-card trio, and #8, the 18px app root, were closed in stage 3; the mobile paper header, the sub-pixel 24px seal and the crowded 768px shell were closed in stage 4.) The public marketing site is a separate identity and is out of scope for this document.
