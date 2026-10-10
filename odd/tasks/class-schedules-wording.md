# Class schedules wording and one-time class creation

User request: the "Concurrencias" screen must be called "Horarios de clases",
every user-facing "concurrencia" wording must change, and the screen must
allow creating a one-time class (today only possible from the calendar).

Branch: feat/class-schedules-wording, stacked on feat/monthly-class-rosters
(the schedule screen with monthly groups only exists there).

## Decisions
- Section, sidebar, header title: "Horarios de clases".
- Singular item replacing "concurrencia": "horario" (e.g. "Renombrar
  horario", "Todo el horario (toda la semana)", "Todos los horarios de la
  sucursal"). Existing "grupo mensual" copy is left as is.
- Code comments/test names mentioning "concurrencias" are reworded to
  "class schedules"; route /dashboard/schedule is unchanged.
- The schedule screen header offers "Crear clase única" (same dialog and
  default teacher as the calendar) next to the monthly group creation.

## Tasks
- [x] T1: Rename all "concurrencia(s)" copy, comments and tests.
- [x] T2: Add one-time class creation to the schedule screen.

## Evidence
- T1+T2 (delegated: gentle-ai-worker). T1: DASHBOARD_SHELL_MESSAGES
  CONCURRENCIAS -> CLASS_SCHEDULES "Horarios de clases" (sidebar, header);
  SCHEDULE_SERIES / REMOVE_RECURRING_CLASS / CLASS_MESSAGES copy reworded to
  "horario(s)" (incl. former "serie" removal copy); comments and test names
  in English. grep "concurrencia" over app/components/lib (excluding
  generated): 0 matches. Parent tweak: "Indique la clase o el horario a
  quitar, no los dos."
  T2: schedule screen header shows "Crear clase única" (branch default
  teacher preloaded) next to monthly group creation; new "Clases únicas"
  section listing upcoming active one-time classes (date, time, discipline,
  teacher, roster count) with roster editor, backed by
  listUpcomingOneTimeClasses (branch guard, sequential tx queries).
  TDD RED (14 failed) -> GREEN. tsc clean; vitest 1079 passed / 1 skipped;
  eslint clean.
