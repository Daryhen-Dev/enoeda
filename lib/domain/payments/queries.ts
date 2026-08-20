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
 * Count distinct students who are overdue (next_due_date < today).
 * Pure tx-scoped query — reusable from dashboard and payments actions.
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function countOverdueStudents(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const disciplineWhere = disciplineId ? { discipline_id: disciplineId } : {};

  const result = await tx.student_disciplines.findMany({
    where: {
      ...disciplineWhere,
      is_active: true,
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
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function listOverdueStudents(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<OverdueStudentRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const disciplineWhere = disciplineId ? { discipline_id: disciplineId } : {};

  const rows = await tx.student_disciplines.findMany({
    where: {
      ...disciplineWhere,
      is_active: true,
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
 * The query stays transaction-scoped so the protected action can reuse it.
 */
export async function getMonthlyPaymentSummaryQuery(
  tx: TransactionClient,
  branchId: string,
  disciplineId?: string
): Promise<MonthlyPaymentSummary> {
  const currentDate = new Date();
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const nextMonthStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    1
  );
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
    countOverdueStudents(tx, branchId, disciplineId),
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
