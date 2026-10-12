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
- [ ] T1: Domain: searchConductStudents and listRecentBranchConductRecords
      in lib/domain/conduct with tests.
- [ ] T2: UI: sidebar entry, /dashboard/conduct quick-entry page, teacher
      actions on the student detail Conducta tab; es-EC copy; tests.

## Evidence
