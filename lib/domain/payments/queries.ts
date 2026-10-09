import { dateOnlyToUtcDate, getCurrentDateOnly } from "@/lib/date";
import {
  ECUADOR_TIME_ZONES,
  ECUADOR_TIME_ZONE_VALUES,
  type EcuadorTimeZone,
} from "@/lib/domain/branches/schema";
import type { TransactionClient } from "@/lib/prisma/client";

export const PAYMENT_ACTIVITY_TYPES = {
  MONTHLY: "monthly",
  CLASS: "class",
} as const;

export type PaymentActivityType =
  (typeof PAYMENT_ACTIVITY_TYPES)[keyof typeof PAYMENT_ACTIVITY_TYPES];

export const MONTHLY_PAYMENT_ACTIVITY_LIMIT = 10;

export interface MonthlyPaymentActivity {
  student_id: string;
  student_name: string;
  discipline_name: string;
  amount: number;
  activity_date: Date;
  type: PaymentActivityType;
}

export interface MonthlyPaymentSummary {
  totalMoneyCollected: number;
  monthlyPaymentCount: number;
  classPaymentCount: number;
  recentActivity: MonthlyPaymentActivity[];
  overdueStudentCount: number;
}

export interface OverdueStudentRow {
  student_discipline_id: string;
  student_id: string;
  student_name: string;
  discipline_name: string;
  next_due_date: Date;
}

/**
 * Normalizes a branch `time_zone` value to an allowed Ecuador zone, falling
 * back to the continental zone. Exported for reuse by payment validation flows.
 */
export function normalizeEcuadorTimeZone(
  timeZone: string | null | undefined
): EcuadorTimeZone {
  if (timeZone !== null && timeZone !== undefined) {
    const allowedTimeZone = ECUADOR_TIME_ZONE_VALUES.find(
      (value) => value === timeZone
    );
    if (allowedTimeZone !== undefined) {
      return allowedTimeZone;
    }
  }

  return ECUADOR_TIME_ZONES.CONTINENTAL;
}

/**
 * Resolves the branch-local calendar date ("YYYY-MM-DD") for the given
 * instant (default now), using the branch's `time_zone`. Falls back to the
 * continental Ecuador time zone when the branch row is missing or carries an
 * unrecognized time zone, consistent with branch context resolution.
 * Exported for reuse by payment validation flows (branch-local today).
 */
export async function getBranchLocalToday(
  tx: TransactionClient,
  branchId: string,
  now: Date = new Date()
): Promise<string> {
  const branch = await tx.branches.findUnique({
    where: { id: branchId },
    select: { time_zone: true },
  });

  return getCurrentDateOnly(normalizeEcuadorTimeZone(branch?.time_zone), now);
}

/**
 * First day of the month following the given date-only value.
 */
function firstDayOfNextMonth(dateOnly: string): string {
  const year = Number(dateOnly.slice(0, 4));
  const month = Number(dateOnly.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * Count distinct students who are overdue (next_due_date < today).
 * "Today" is the branch-local calendar date, converted to the UTC-midnight
 * instant used by Postgres `date` columns.
 * Pure tx-scoped query — reusable from dashboard and payments actions.
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function countOverdueStudents(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<number> {
  const today = dateOnlyToUtcDate(await getBranchLocalToday(tx, branchId));
  return countOverdueStudentsOn(tx, branchId, today, disciplineId);
}

/**
 * Overdue count against a pre-resolved UTC-midnight "today" so callers that
 * already resolved the branch-local date avoid a second branch lookup.
 */
async function countOverdueStudentsOn(
  tx: TransactionClient,
  branchId: string,
  today: Date,
  disciplineId?: string
): Promise<number> {
  const disciplineWhere = disciplineId ? { discipline_id: disciplineId } : {};

  const result = await tx.student_disciplines.findMany({
    where: {
      ...disciplineWhere,
      is_active: true,
      // Per-class enrollments are never overdue (T8).
      billing_mode: "monthly",
      next_due_date: { lt: today },
      students: { branch_id: branchId },
    },
    select: { student_id: true },
    distinct: ["student_id"],
  });

  return result.length;
}

/**
 * Lists overdue enrollment rows so each student-discipline can be acted on.
 * "Today" is the branch-local calendar date, converted to the UTC-midnight
 * instant used by Postgres `date` columns.
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function listOverdueStudents(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<OverdueStudentRow[]> {
  const today = dateOnlyToUtcDate(await getBranchLocalToday(tx, branchId));
  const disciplineWhere = disciplineId ? { discipline_id: disciplineId } : {};

  const rows = await tx.student_disciplines.findMany({
    where: {
      ...disciplineWhere,
      is_active: true,
      // Per-class enrollments are never overdue (T8).
      billing_mode: "monthly",
      next_due_date: { lt: today },
      students: { branch_id: branchId },
    },
    select: {
      id: true,
      discipline_id: true,
      students: { select: { id: true, first_name: true, surname: true } },
      disciplines: { select: { name: true } },
      next_due_date: true,
    },
    orderBy: { next_due_date: "asc" },
  });

  return rows.map((row) => ({
    student_discipline_id: row.id,
    student_id: row.students.id,
    student_name: `${row.students.first_name} ${row.students.surname}`,
    discipline_name: row.disciplines.name,
    next_due_date: row.next_due_date!,
  }));
}

/**
 * Returns the current calendar month's branch-scoped payment activity.
 * The month bounds and "today" are derived from the branch-local date.
 * The query stays transaction-scoped so the protected action can reuse it.
 */
export async function getMonthlyPaymentSummaryQuery(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<MonthlyPaymentSummary> {
  const today = await getBranchLocalToday(tx, branchId);
  const monthStart = dateOnlyToUtcDate(`${today.slice(0, 7)}-01`);
  const nextMonthStart = dateOnlyToUtcDate(firstDayOfNextMonth(today));
  const dateRange = { gte: monthStart, lt: nextMonthStart };
  const enrollmentFilter = disciplineId ? { discipline_id: disciplineId } : {};

  const [monthlyPayments, classPayments, overdueStudentCount] = await Promise.all([
    tx.payments.findMany({
      where: {
        payment_date: dateRange,
        student_disciplines: {
          ...enrollmentFilter,
          students: { branch_id: branchId },
        },
      },
      select: {
        amount: true,
        payment_date: true,
        student_disciplines: {
          select: {
            student_id: true,
            students: { select: { first_name: true, surname: true } },
            disciplines: { select: { name: true } },
          },
        },
      },
    }),
    tx.class_payments.findMany({
      where: {
        class_date: dateRange,
        student_disciplines: {
          ...enrollmentFilter,
          students: { branch_id: branchId },
        },
      },
      select: {
        amount: true,
        class_date: true,
        student_disciplines: {
          select: {
            student_id: true,
            students: { select: { first_name: true, surname: true } },
            disciplines: { select: { name: true } },
          },
        },
      },
    }),
    countOverdueStudentsOn(
      tx,
      branchId,
      dateOnlyToUtcDate(today),
      disciplineId
    ),
  ]);

  const monthlyActivity: MonthlyPaymentActivity[] = monthlyPayments.map((payment) => ({
    student_id: payment.student_disciplines.student_id,
    student_name: `${payment.student_disciplines.students.first_name} ${payment.student_disciplines.students.surname}`,
    discipline_name: payment.student_disciplines.disciplines.name,
    amount: Number(payment.amount),
    activity_date: payment.payment_date,
    type: PAYMENT_ACTIVITY_TYPES.MONTHLY,
  }));
  const classActivity: MonthlyPaymentActivity[] = classPayments.map((payment) => ({
    student_id: payment.student_disciplines.student_id,
    student_name: `${payment.student_disciplines.students.first_name} ${payment.student_disciplines.students.surname}`,
    discipline_name: payment.student_disciplines.disciplines.name,
    amount: Number(payment.amount),
    activity_date: payment.class_date,
    type: PAYMENT_ACTIVITY_TYPES.CLASS,
  }));
  const activity = [...monthlyActivity, ...classActivity]
    .sort((left, right) => right.activity_date.getTime() - left.activity_date.getTime())
    .slice(0, MONTHLY_PAYMENT_ACTIVITY_LIMIT);
  const totalAmount = [...monthlyActivity, ...classActivity].reduce(
    (total, payment) => total + payment.amount,
    0
  );

  return {
    totalMoneyCollected: totalAmount,
    monthlyPaymentCount: monthlyPayments.length,
    classPaymentCount: classPayments.length,
    overdueStudentCount: overdueStudentCount,
    recentActivity: activity,
  };
}
