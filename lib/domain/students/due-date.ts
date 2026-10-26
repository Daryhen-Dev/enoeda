import { getCalendarDayDifference } from "@/lib/date"
import { STUDENT_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Due-date rules shared by the directory table, the mobile card and the
 * detail-page status strip. Kept out of any "use client" module so a server
 * component can call them directly instead of receiving a client reference.
 */

export interface DueDateCandidate {
  billing_mode: "monthly" | "per_class"
  next_due_date: string | null
}

/** Nearest monthly enrollment that can go overdue; per-class ones never do. */
export function getNearestDueDiscipline<T extends DueDateCandidate>(
  disciplines: T[]
): T | undefined {
  return disciplines
    .filter((discipline) => discipline.billing_mode === "monthly")
    .reduce<T | undefined>((nearest, discipline) => {
      if (discipline.next_due_date === null) return nearest

      if (
        nearest === undefined ||
        nearest.next_due_date === null ||
        discipline.next_due_date < nearest.next_due_date
      ) {
        return discipline
      }

      return nearest
    }, undefined)
}

/** Days until the due date: negative when overdue, 0 when due today. */
export function getDueDateRemainingDays(dueDate: string, today: string): number {
  return getCalendarDayDifference(today, dueDate)
}

/** Due-date wording shared by every surface that shows it. */
export function getDueDateStatus(dueDate: string, today: string): string {
  const remainingDays = getDueDateRemainingDays(dueDate, today)

  if (remainingDays > 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_IN_DAYS(remainingDays)
  }

  if (remainingDays === 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_TODAY
  }

  return STUDENT_DIRECTORY_MESSAGES.OVERDUE_BY_DAYS(Math.abs(remainingDays))
}
