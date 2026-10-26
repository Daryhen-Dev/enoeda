export const CALENDAR_VIEWS = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
} as const

export type CalendarView = (typeof CALENDAR_VIEWS)[keyof typeof CALENDAR_VIEWS]

export interface CalendarRoleFlags {
  /** True when the caller holds the teacher role without the admin role. */
  isTeacherOnly: boolean
}

const EXPLICIT_VIEWS = new Set<string>(Object.values(CALENDAR_VIEWS))

/**
 * Picks the calendar view for a request. An explicit, known `?view=` always
 * wins; otherwise a teacher-only user lands on today's classes and an admin
 * keeps the month overview.
 */
export function resolveCalendarView(
  viewParam: string | undefined,
  flags: CalendarRoleFlags
): CalendarView {
  if (viewParam !== undefined && EXPLICIT_VIEWS.has(viewParam)) {
    return viewParam as CalendarView
  }

  return flags.isTeacherOnly ? CALENDAR_VIEWS.DAY : CALENDAR_VIEWS.MONTH
}
