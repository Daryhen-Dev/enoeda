"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { COMMON_MESSAGES, PAYMENT_MESSAGES } from "@/lib/localization/es-ec";
import {
  configureDisciplineClassPriceSchema,
  registerMonthlyPaymentSchema,
  registerClassPaymentSchema,
  getStudentPaymentsSchema,
  type ConfigureDisciplineClassPriceInput,
  type RegisterMonthlyPaymentInput,
  type RegisterClassPaymentInput,
  type GetStudentPaymentsInput,
} from "./schema";
import {
  countOverdueStudents,
  listOverdueStudents,
  type OverdueStudentRow,
} from "./queries";

interface ActionSuccess<T> {
  success: true;
  data: T;
}

interface ActionFailure {
  success: false;
  error: string;
}

type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export interface PaymentRecord {
  id: string;
  discipline_name: string;
  amount: number;
  months_covered: number;
  period_start: Date;
  period_end: Date;
  payment_date: Date;
  recorded_by: string;
  note: string | null;
  created_at: Date;
}

export interface ClassPaymentRecord {
  id: string;
  discipline_name: string;
  amount: number;
  class_date: Date;
  recorded_by: string;
  created_at: Date;
}

/**
 * Admin sets/clears class_price on a discipline.
 * RLS restricts UPDATE to Admin via the policy on disciplines.
 * Even though disciplines are global reference data, the caller must have
 * a valid active branch context as defense-in-depth (no context-free mutations).
 */
export async function configureDisciplineClassPrice(
  input: ConfigureDisciplineClassPriceInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = configureDisciplineClassPriceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Caller must have active branch assignment (defense-in-depth for global mutation)
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError };
      }

      const discipline = await tx.disciplines.update({
        where: { id: parsed.data.discipline_id },
        data: { class_price: parsed.data.class_price },
        select: { id: true },
      });
      return { id: discipline.id, error: null };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Admin registers a monthly/block payment (1-12 months).
 * Atomically updates next_due_date on the enrollment.
 * Requires branch context; validates enrollment belongs to the caller's branch.
 */
export async function registerMonthlyPayment(
  input: RegisterMonthlyPaymentInput
): Promise<ActionResult<{ id: string; next_due_date: string }>> {
  const parsed = registerMonthlyPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Assert caller branch context
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, next_due_date: null, error: branchError };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: {
          id: true,
          next_due_date: true,
          students: { select: { branch_id: true } },
        },
      });

      if (!enrollment) {
        return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.ENROLLMENT_NOT_FOUND };
      }

      // Cross-branch guard: enrollment's student must belong to caller's branch
      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return { id: null, next_due_date: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const paymentDate = parsed.data.payment_date
        ? new Date(parsed.data.payment_date)
        : today;

      const existingDueDate = enrollment.next_due_date
        ? new Date(enrollment.next_due_date)
        : null;

      const base =
        existingDueDate && existingDueDate > today
          ? existingDueDate
          : paymentDate;

      const periodEnd = new Date(base);
      periodEnd.setMonth(periodEnd.getMonth() + parsed.data.months_covered);

      const payment = await tx.payments.create({
        data: {
          student_discipline_id: enrollment.id,
          amount: parsed.data.amount,
          months_covered: parsed.data.months_covered,
          period_start: base,
          period_end: periodEnd,
          payment_date: paymentDate,
          recorded_by: ctx.userId,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      await tx.student_disciplines.update({
        where: { id: enrollment.id },
        data: { next_due_date: periodEnd },
      });

      return {
        id: payment.id,
        next_due_date: periodEnd.toISOString().split("T")[0],
        error: null,
      };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }

    return {
      success: true,
      data: { id: result.data.id, next_due_date: result.data.next_due_date! },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Admin + Teacher registers a per-class payment.
 * Amount is auto-read from disciplines.class_price; rejects when NULL.
 * Requires branch context; validates enrollment belongs to the caller's branch.
 */
export async function registerClassPayment(
  input: RegisterClassPaymentInput
): Promise<ActionResult<{ id: string; amount: number }>> {
  const parsed = registerClassPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Assert caller branch context
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, amount: null, error: branchError };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: {
          id: true,
          disciplines: { select: { class_price: true } },
          students: { select: { branch_id: true } },
        },
      });

      if (!enrollment) {
        return { id: null, amount: null, error: PAYMENT_MESSAGES.ENROLLMENT_NOT_FOUND };
      }

      // Cross-branch guard
      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return { id: null, amount: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      const classPrice = enrollment.disciplines.class_price;
      if (classPrice === null || classPrice === undefined) {
        return { id: null, amount: null, error: PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET };
      }

      const classPayment = await tx.class_payments.create({
        data: {
          student_discipline_id: enrollment.id,
          amount: classPrice,
          class_date: parsed.data.class_date
            ? new Date(parsed.data.class_date)
            : undefined,
          scheduled_class_id: parsed.data.scheduled_class_id ?? null,
          recorded_by: ctx.userId,
        },
        select: { id: true, amount: true },
      });

      return {
        id: classPayment.id,
        amount: Number(classPayment.amount),
        error: null,
      };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }

    return {
      success: true,
      data: { id: result.data.id, amount: result.data.amount! },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get all payments (monthly + per-class) for a student.
 * Requires branch context; validates student belongs to the caller's branch.
 */
export async function getStudentPayments(
  input: GetStudentPaymentsInput
): Promise<ActionResult<{ monthly: PaymentRecord[]; perClass: ClassPaymentRecord[] }>> {
  const parsed = getStudentPaymentsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Assert caller branch context
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      // Validate student belongs to branch
      const student = await tx.students.findUnique({
        where: { id: parsed.data.student_id },
        select: { branch_id: true },
      });

      if (!student || student.branch_id !== parsed.data.branch_id) {
        return { __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      const [monthly, perClass] = await Promise.all([
        tx.payments.findMany({
          where: { student_disciplines: { student_id: parsed.data.student_id } },
          select: {
            id: true,
            amount: true,
            months_covered: true,
            period_start: true,
            period_end: true,
            payment_date: true,
            recorded_by: true,
            note: true,
            created_at: true,
            student_disciplines: {
              select: { disciplines: { select: { name: true } } },
            },
          },
          orderBy: { created_at: "desc" },
        }),
        tx.class_payments.findMany({
          where: { student_disciplines: { student_id: parsed.data.student_id } },
          select: {
            id: true,
            amount: true,
            class_date: true,
            recorded_by: true,
            created_at: true,
            student_disciplines: {
              select: { disciplines: { select: { name: true } } },
            },
          },
          orderBy: { created_at: "desc" },
        }),
      ]);

      return {
        monthly: monthly.map((row) => ({
          id: row.id,
          discipline_name: row.student_disciplines.disciplines.name,
          amount: Number(row.amount),
          months_covered: row.months_covered,
          period_start: row.period_start,
          period_end: row.period_end,
          payment_date: row.payment_date,
          recorded_by: row.recorded_by,
          note: row.note,
          created_at: row.created_at,
        })),
        perClass: perClass.map((row) => ({
          id: row.id,
          discipline_name: row.student_disciplines.disciplines.name,
          amount: Number(row.amount),
          class_date: row.class_date,
          recorded_by: row.recorded_by,
          created_at: row.created_at,
        })),
      };
    });

    if (!result.success) return result;
    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }
    return { success: true, data: result.data as { monthly: PaymentRecord[]; perClass: ClassPaymentRecord[] } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get count of overdue students for the current branch context.
 * Requires validated branchId — callers must resolve context at page level.
 */
export async function getOverdueStudentCount(
  branchId: string
): Promise<ActionResult<number>> {
  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return countOverdueStudents(tx, branchId);
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get list of overdue students with details.
 * Requires validated branchId — callers must resolve context at page level.
 */
export async function getOverdueStudents(
  branchId: string
): Promise<ActionResult<OverdueStudentRow[]>> {
  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return listOverdueStudents(tx, branchId);
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
