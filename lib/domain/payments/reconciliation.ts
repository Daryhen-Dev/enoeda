import { formatDateOnly, parseDateOnly } from "@/lib/date";

export interface PaymentCoveragePeriod {
  period_start: string;
  period_end: string;
}

const PAYMENT_MONTH_RANGE_ERROR = {
  INVALID_MONTH: "invalid_month",
  END_BEFORE_START: "end_before_start",
  DURATION_EXCEEDS_MAX: "duration_exceeds_max",
} as const;

type PaymentMonthRangeErrorCode =
  (typeof PAYMENT_MONTH_RANGE_ERROR)[keyof typeof PAYMENT_MONTH_RANGE_ERROR];

interface PaymentMonthValue {
  year: number;
  month: number;
}

export interface PaymentMonthRange {
  period_start: string;
  period_end: string;
}

export interface PaymentMonthRangeResult {
  period: PaymentMonthRange | null;
  error: PaymentMonthRangeErrorCode | null;
}

const PAYMENT_MONTH_VALUE_PATTERN = /^(\d{4})-(\d{2})$/;

function parsePaymentMonth(value: string): PaymentMonthValue | null {
  const match = PAYMENT_MONTH_VALUE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

function formatPaymentMonth({ year, month }: PaymentMonthValue): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getNextPaymentMonth(month: PaymentMonthValue): PaymentMonthValue {
  return month.month === 12
    ? { year: month.year + 1, month: 1 }
    : { year: month.year, month: month.month + 1 };
}

export function getPreviousPaymentMonth(value: string): string {
  const month = parsePaymentMonth(value);
  if (!month) return value;

  return formatPaymentMonth(
    month.month === 1
      ? { year: month.year - 1, month: 12 }
      : { year: month.year, month: month.month - 1 }
  );
}

export function getMonthlyPaymentPeriod(
  startMonth: string,
  endMonth: string
): PaymentMonthRangeResult {
  const start = parsePaymentMonth(startMonth);
  const end = parsePaymentMonth(endMonth);
  if (!start || !end) {
    return { period: null, error: PAYMENT_MONTH_RANGE_ERROR.INVALID_MONTH };
  }

  const inclusiveMonths = (end.year - start.year) * 12 + end.month - start.month + 1;
  if (inclusiveMonths < 1) {
    return { period: null, error: PAYMENT_MONTH_RANGE_ERROR.END_BEFORE_START };
  }
  if (inclusiveMonths > 24) {
    return { period: null, error: PAYMENT_MONTH_RANGE_ERROR.DURATION_EXCEEDS_MAX };
  }

  return {
    period: {
      period_start: `${formatPaymentMonth(start)}-01`,
      period_end: `${formatPaymentMonth(getNextPaymentMonth(end))}-01`,
    },
    error: null,
  };
}

export function isPaymentCorrectionWithinWindow(
  createdAt: Date,
  windowDays: number,
  now: Date = new Date()
): boolean {
  return now.getTime() <= createdAt.getTime() + windowDays * 24 * 60 * 60 * 1000;
}

export function calculateClampedDueDate(monthStart: string, dueDay: number): string {
  const month = parseDateOnly(monthStart);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return formatDateOnly(new Date(month.getFullYear(), month.getMonth(), Math.min(dueDay, lastDay)));
}

/** Mirrors the database reconciliation algorithm for focused domain tests. */
export function reconcileNextDueDate(
  coverage: PaymentCoveragePeriod[],
  dueDay: number
): string | null {
  if (coverage.length === 0) return null;

  const ordered = [...coverage].sort((left, right) =>
    left.period_start.localeCompare(right.period_start)
  );
  let firstUncovered = ordered[0]?.period_start;
  if (!firstUncovered) return null;

  for (const period of ordered) {
    if (period.period_start > firstUncovered) break;
    if (period.period_end > firstUncovered) firstUncovered = period.period_end;
  }
  return calculateClampedDueDate(firstUncovered, dueDay);
}
