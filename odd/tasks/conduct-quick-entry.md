# Conduct quick entry (sidebar)

User request: add "Conducta" to the dashboard sidebar so staff can quickly
search a student and register a fine or a warning, focused on a fast,
pleasant flow.

Branch: feat/conduct-quick-entry, from main (after PR #195).

## Findings
- Sidebar: components/app-sidebar.tsx navigationItems (adminOnly,
  hiddenForTeacherOnly, branchScoped flags); branch kept via ?branch=.
- Pages resolve branch via resolveBranchContext; canManage = branch admin
  only. Teachers can write conduct records per the DB/domain (PR #195), but
  the student detail Conducta tab gates actions on canManage (admin only).
- No shared student search component. listStudents searches name/surname
  only; roster candidate search (debounced, seq guard) also uses cédula.
- Domain module lib/domain/conduct already has create/pay/void actions.

## Decisions (parent, user asked for fast UX without specifics)
- New page /dashboard/conduct, visible to admins and teachers of the
  branch: debounced student search (name, surname or cédula, active
  students), pick a student, inline form (kind, reason, amount for fines,
  incident date default today), register without leaving the page, then
  ready for the next one. Below: recent records of the branch with link to
  the student detail.
- Teachers of the branch also get the actions on the student detail
  Conducta tab (aligns UI with the PR #195 decision "admin and teacher").

## Tasks
- [x] T1: Domain: searchConductStudents and listRecentBranchConductRecords
      in lib/domain/conduct with tests.
- [x] T2: UI: sidebar entry, /dashboard/conduct quick-entry page, teacher
      actions on the student detail Conducta tab; es-EC copy; tests.

## Evidence
- T1 (delegated: gentle-ai-worker), commit 486b7b1: searchConductStudents
  (active branch students, every term matches name/surname/cédula, max 8,
  counters via one groupBy excluding voided) and
  listRecentBranchConductRecords (default 10, max 25, includes voided).
  TDD RED 25 failed -> GREEN 70/70; tsc clean; eslint clean; pnpm test
  1243 passed / 1 skipped.
- T2 (delegated: gentle-ai-worker; verified by gentle-ai-verify): sidebar
  "Conducta" (GavelIcon, after Estudiantes, admins and teachers);
  /dashboard/conduct with autofocused debounced combobox search (keyboard
  pick, Escape), selected card + inline form (kind toggle kept between
  entries, amount only for fines), toast + refresh + reset + refocus;
  "Últimos registros" list. canWriteConduct (admin or teacher of the
  branch) added to resolveBranchContext; it gates conduct only on the
  student detail tab (canManage unchanged). Shared form module
  components/conduct/conduct-form.ts reused by the dialog. Parent fix:
  page uses the same branch scope as Estudiantes (no global-admin read
  mode, which would show a load error). TDD RED 8 failed -> GREEN; tsc
  clean; eslint clean; pnpm test 1259 passed / 1 skipped; pnpm build ok
  (/dashboard/conduct listed). Not checked in a browser.
