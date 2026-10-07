/**
 * Pure payment-validation domain logic. No I/O, no "use server".
 *
 * Classification compares date-only strings ("YYYY-MM-DD") so no local-time
 * Date construction can skew the day math; day arithmetic uses the calendar
 * day difference helpers from lib/date.
 */
import {
  dateOnlyToUtcDate,
  formatDatabaseDateOnly,
  getCalendarDayDifference,
} from "@/lib/date";

export const PAYMENT_VALIDATION_STATUS = {
  UP_TO_DATE: "up_to_date",
  IN_GRACE: "in_grace",
  TO_SUSPEND: "to_suspend",
} as const;

export type PaymentValidationStatus =
  (typeof PAYMENT_VALIDATION_STATUS)[keyof typeof PAYMENT_VALIDATION_STATUS];

export interface EnrollmentPaymentClassification {
  status: PaymentValidationStatus;
  daysOverdue: number;
  /** Due date + grace days ("YYYY-MM-DD"); null when the enrollment has no due date. */
  graceDeadline: string | null;
}

export interface ClassifyEnrollmentInput {
  nextDueDate: string | null;
  today: string;
  graceDays: number;
}

/**
 * Adds whole calendar days to a date-only string using UTC-midnight instants
 * (UTC days are always 24h, so this stays date-only safe).
 */
function addDaysToDateOnly(value: string, days: number): string {
  const utc = dateOnlyToUtcDate(value);
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatDatabaseDateOnly(utc);
}

/**
 * Classifies an enrollment against the branch-local today:
 * - up_to_date: no due date, or due today or later.
 * - in_grace: overdue but today <= due + grace days.
 * - to_suspend: today > due + grace days.
 */
export function classifyEnrollment(
  input: ClassifyEnrollmentInput
): EnrollmentPaymentClassification {
  if (input.nextDueDate === null) {
    return { status: PAYMENT_VALIDATION_STATUS.UP_TO_DATE, daysOverdue: 0, graceDeadline: null };
  }

  const graceDeadline = addDaysToDateOnly(input.nextDueDate, input.graceDays);
  const daysOverdue = Math.max(0, getCalendarDayDifference(input.nextDueDate, input.today));

  if (daysOverdue === 0) {
    return { status: PAYMENT_VALIDATION_STATUS.UP_TO_DATE, daysOverdue, graceDeadline };
  }
  if (input.today <= graceDeadline) {
    return { status: PAYMENT_VALIDATION_STATUS.IN_GRACE, daysOverdue, graceDeadline };
  }
  return { status: PAYMENT_VALIDATION_STATUS.TO_SUSPEND, daysOverdue, graceDeadline };
}

/**
 * UTC offset (in minutes) of the given IANA time zone at the given instant.
 * Positive when local time is ahead of UTC. Derived with Intl so it works
 * for any zone without hardcoding offsets.
 */
function getTimeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const readPart = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Time zone formatter did not return the "${type}" part.`);
    }
    return Number(value);
  };

  const wallClockAsUtc = Date.UTC(
    readPart("year"),
    readPart("month") - 1,
    readPart("day"),
    readPart("hour"),
    readPart("minute"),
    readPart("second")
  );

  return (wallClockAsUtc - instant.getTime()) / 60_000;
}

/**
 * Resolves the UTC instant of local midnight for the given year/month in the
 * given time zone. Two refinement passes handle zones whose offset changes
 * near the boundary (not needed for Ecuador's fixed offsets, but robust).
 */
function zonedMonthStartUtc(
  timeZone: string,
  year: number,
  month1Based: number
): Date {
  const wallClockAsUtc = Date.UTC(year, month1Based - 1, 1, 0, 0, 0);
  let instant = wallClockAsUtc;

  for (let pass = 0; pass < 2; pass += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date(instant));
    instant = wallClockAsUtc - offsetMinutes * 60_000;
  }

  return new Date(instant);
}

export interface BranchLocalMonthBounds {
  /** Inclusive lower bound (UTC instant of local midnight on day 1). */
  start: Date;
  /** Exclusive upper bound (UTC instant of local midnight on day 1 of next month). */
  end: Date;
}

/**
 * UTC instant bounds of the branch-local calendar month containing `today`
 * ("YYYY-MM-DD"), for timestamptz range filters ([start, end)).
 */
export function getBranchLocalMonthBounds(
  today: string,
  timeZone: string
): BranchLocalMonthBounds {
  const anchor = dateOnlyToUtcDate(today);
  const year = anchor.getUTCFullYear();
  const month1Based = anchor.getUTCMonth() + 1;

  const start = zonedMonthStartUtc(timeZone, year, month1Based);
  const end =
    month1Based === 12
      ? zonedMonthStartUtc(timeZone, year + 1, 1)
      : zonedMonthStartUtc(timeZone, year, month1Based + 1);

  return { start, end };
}
