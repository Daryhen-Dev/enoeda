import type { EcuadorTimeZone } from "@/lib/domain/branches/schema";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PART_TYPES = {
  YEAR: "year",
  MONTH: "month",
  DAY: "day",
} as const;
const DATE_PART_FORMAT_OPTIONS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
} as const satisfies Intl.DateTimeFormatOptions;

interface DateOnlyValues {
  year: number;
  month: number;
  day: number;
}

function parseDateOnlyValues(value: string): DateOnlyValues {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(year, month, 0).getDate();

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new Error("Date must be valid.");
  }

  return { year, month, day };
}

function getDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: (typeof DATE_PART_TYPES)[keyof typeof DATE_PART_TYPES]
): string {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new Error("Date formatter did not return a required date part.");
  }

  return value;
}

function dateOnlyToDayNumber(value: string): number {
  const { year, month, day } = parseDateOnlyValues(value);
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;

  return era * 146097 + dayOfEra;
}

export function parseDateOnly(value: string): Date {
  const { year, month, day } = parseDateOnlyValues(value);

  return new Date(year, month - 1, day);
}

export function formatDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatDatabaseDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function getCurrentDateOnly(
  timeZone: EcuadorTimeZone,
  date: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    ...DATE_PART_FORMAT_OPTIONS,
    timeZone,
  }).formatToParts(date);

  return `${getDatePart(parts, DATE_PART_TYPES.YEAR)}-${getDatePart(
    parts,
    DATE_PART_TYPES.MONTH
  )}-${getDatePart(parts, DATE_PART_TYPES.DAY)}`;
}

export function getCalendarDayDifference(
  startDateOnly: string,
  endDateOnly: string
): number {
  return dateOnlyToDayNumber(endDateOnly) - dateOnlyToDayNumber(startDateOnly);
}
