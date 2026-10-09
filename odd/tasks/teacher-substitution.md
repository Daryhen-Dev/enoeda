# Teacher substitution gaps

User request (points 1, 2, 3 of the substitution review): one-time classes
need a teacher change, monthly groups need a group-wide teacher change, and a
day substitution must be undoable.

Branch: feat/teacher-substitution, stacked on feat/class-schedules-wording.

## Findings
- Recurring day substitution exists: assignTeacher target "session" upserts
  class_sessions.assigned_teacher_id; resolve_effective_teacher (override ->
  attribution period -> default_teacher_id) drives calendar and attendance
  RLS; the calendar shows "Sustituto".
- assignTeacher target "recurring" only updates ONE weekday row's
  default_teacher_id and no UI calls it; it also rewrites past occurrences
  because rows created after 20260828000000 have no attribution periods.
- teacher_attribution_periods is SELECT-only for authenticated (no write
  grant), so period writes need a SECURITY DEFINER RPC.
- one_time_classes.teacher_id cannot be changed from the app.
- No action clears a session override.

## Decisions
- Group teacher change applies from now on (cutoff = now(), same rule as
  revoke_teacher_with_reassignment): past occurrences keep the previous
  teacher; explicit day substitutions are kept. Recommended by the parent;
  the user accepted points 1-3 without choosing otherwise.
- The new teacher must hold an active teacher role in the branch (all three
  actions). Admin of the branch or owner only.
- Remove assignTeacher target "recurring" (unsafe and unused).

## Tasks
- [x] T1: Migration 20260911000000: public.set_class_series_teacher RPC
      (validate, close/open attribution periods per active weekday row incl.
      a baseline period for rows without one, update class_series and rows).
- [x] T2: Domain: setClassSeriesTeacher, setOneTimeClassTeacher,
      clearSessionSubstitution; drop target "recurring".
- [x] T3: UI: group teacher change in the schedule list, one-time teacher
      change (calendar + schedule list), "Quitar sustitución".
- [x] T4: Apply migration to Supabase (user-authorized pattern), verify.

## Evidence
- T1+T2 (delegated: gentle-ai-worker): migration 20260911000000 with
  public.set_class_series_teacher (owner/branch admin, active teacher role,
  cutoff now(): baseline period for rows without periods, close open
  periods, open new period, update rows + group; day substitutions kept;
  EXECUTE only for authenticated). Parent fix: baseline effective_from is
  -infinity instead of the row's created_at, because a mid-month group still
  renders occurrences before its creation and those must keep the previous
  teacher. Domain: setClassSeriesTeacher (RPC via $queryRaw, error mapping),
  setOneTimeClassTeacher (any date, teacher role validated),
  clearSessionSubstitution (keeps the row for suspension state);
  assignTeacher is session-only and now validates the teacher role.
  TDD RED (ENOENT / 36 failed) -> GREEN. tsc clean; vitest 1127 passed /
  1 skipped; eslint clean.
- T3 (delegated: gentle-ai-worker): schedule list "Cambiar profesor" per
  monthly group (teacher or "Sin profesor", from-now explanation, disabled
  for inactive groups); new components/classes/one-time-teacher-dialog.tsx
  used in the calendar session block and the "Clases únicas" rows; "Quitar
  sustitución" with confirm in the calendar for substituted recurring
  sessions; per-day "Cambiar profesor" copy now states it is a date-only
  substitution. 13 new component tests (written alongside, no RED captured;
  Base UI Select option clicks are not exercised in jsdom, payload mapping
  covered via preselection). Parent re-ran the 3 UI test files twice: 22/22.
  tsc clean; vitest 1140 passed / 1 skipped; eslint clean; pnpm build OK.
- T4: migration 20260911000000 APPLIED to Supabase dboqqtfsywhjqhbpxdbm
  (user-authorized) via `pg` + DATABASE_URL, committed file as one
  transaction. Precheck: function absent. Post-check: SECURITY DEFINER,
  search_path="", args (p_series_id uuid, p_teacher_id uuid), EXECUTE for
  authenticated (+ postgres owner). Live probe as a non-owner branch admin
  (rolled back): RPC returned updatedClassCount 1; past occurrence resolves
  to the previous teacher, future occurrence to the new one. The probe's
  "non-teacher" candidate also held a teacher role in the branch, so its
  acceptance was correct (probe defect, not a function defect); rejection
  of a non-teacher is covered by the structural test only. After rollback
  0 attribution periods; the 1 class_series row present is a real group
  created by the user at 16:16, not probe data.
