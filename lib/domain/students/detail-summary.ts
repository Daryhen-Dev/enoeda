import type { PaymentRecord } from "@/lib/domain/payments/actions";
import type { StudentDisciplineRecord } from "@/lib/domain/disciplines/actions";
import { formatDatabaseDateOnly } from "@/lib/date";

/**
 * Age in whole completed years for a date-only birth value.
 *
 * Birth dates are stored as UTC midnight instants, so the date-only value is
 * recovered with UTC components (formatDatabaseDateOnly). The reference date
 * must be passed as a date-only string ("YYYY-MM-DD") computed in the
 * branch's timezone (see getCurrentDateOnly) — deriving "today" from the UTC
 * instant would count birthdays a day early between 19:00 and midnight
 * Ecuador time. A February 29 birthday counts as reached on March 1 of
 * non-leap years.
 */
export function getAgeInYears(
  dateOfBirth: Date,
  todayDateOnly: string
): number {
  const birthDateOnly = formatDatabaseDateOnly(dateOfBirth);

  const birthYear = Number(birthDateOnly.slice(0, 4));
  const birthMonthDay = birthDateOnly.slice(5);
  const todayYear = Number(todayDateOnly.slice(0, 4));
  const todayMonthDay = todayDateOnly.slice(5);

  let age = todayYear - birthYear;
  if (todayMonthDay < birthMonthDay) {
    age -= 1;
  }

  return age;
}

/**
 * Latest monthly-payment period_end for a discipline, matched by name
 * (PaymentRecord carries no discipline id). Names are compared trimmed so
 * incidental whitespace differences still match. Returns null when no
 * monthly payment exists for the discipline.
 */
export function getLatestPaidThrough(
  payments: PaymentRecord[],
  disciplineName: string
): Date | null {
  const targetName = disciplineName.trim();
  let latest: Date | null = null;

  for (const payment of payments) {
    if (payment.discipline_name.trim() !== targetName) continue;
    if (!latest || payment.period_end.getTime() > latest.getTime()) {
      latest = payment.period_end;
    }
  }

  return latest;
}

/**
 * Orders enrollments active-first while preserving the relative order
 * inside each group. Returns a new array; the input is not mutated.
 */
export function orderEnrollmentsActiveFirst(
  enrollments: StudentDisciplineRecord[]
): StudentDisciplineRecord[] {
  return [
    ...enrollments.filter((enrollment) => enrollment.is_active),
    ...enrollments.filter((enrollment) => !enrollment.is_active),
  ];
}
