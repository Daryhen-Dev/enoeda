"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchAdmin,
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import {
  authorizeBranchRead,
  BRANCH_READ_ACCESS,
} from "@/lib/auth/branch-read-access";
import { formatDatabaseDateOnly, formatDateOnly, parseDateOnly } from "@/lib/date";
import type { TransactionClient } from "@/lib/prisma/client";
import { BRANCH_MESSAGES, COMMON_MESSAGES, PAYMENT_MESSAGES } from "@/lib/localization/es-ec";
import {
  configureDisciplineClassPriceSchema,
  registerMonthlyPaymentSchema,
  registerClassPaymentSchema,
  getStudentPaymentsSchema,
  paymentConsoleFilterSchema,
  deriveMonthsCovered,
  correctMonthlyPaymentSchema,
  correctClassPaymentSchema,
  deletePaymentSchema,
  type ConfigureDisciplineClassPriceInput,
  type RegisterMonthlyPaymentInput,
  type RegisterClassPaymentInput,
  type CorrectMonthlyPaymentInput,
  type CorrectClassPaymentInput,
  type DeletePaymentInput,
  type GetStudentPaymentsInput,
  type PaymentConsoleFilterInput,
} from "./schema";
import { isPaymentCorrectionWithinWindow } from "./reconciliation";
import {
  countOverdueStudents,
  getMonthlyPaymentSummaryQuery,
  listOverdueStudents,
  type MonthlyPaymentSummary,
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

interface BranchPaymentSettingsRow {
  payment_due_day: number;
  payment_edit_window_days: number;
}

interface PaymentResourceRow {
  id: string;
  created_at: Date;
  student_discipline_id: string;
  student_disciplines: { students: { branch_id: string } };
}

function mapPaymentTransactionError(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.message.includes("payments_coverage_no_overlap")) {
    return PAYMENT_MESSAGES.PERIOD_OVERLAP;
  }
  return undefined;
}

async function getBranchPaymentSettings(
  tx: TransactionClient,
  branchId: string
): Promise<BranchPaymentSettingsRow | null> {
  const rows = await tx.$queryRaw<BranchPaymentSettingsRow[]>`
    SELECT payment_due_day, payment_edit_window_days
    FROM public.branches
    WHERE id = ${branchId} AND is_active = true
  `;
  return rows[0] ?? null;
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
      // Pricing changes are restricted to an active branch administrator.
      const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
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
 * An active branch admin registers a monthly payment for an inclusive range
 * of up to 24 calendar months. The database reconciles next_due_date using
 * the branch due-day configuration after each insert.
 */
export async function registerMonthlyPayment(
  input: RegisterMonthlyPaymentInput
): Promise<ActionResult<{ id: string; next_due_date: string }>> {
  const parsed = registerMonthlyPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, next_due_date: null, error: branchError };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: { id: true, students: { select: { branch_id: true } } },
      });
      if (!enrollment) {
        return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.ENROLLMENT_NOT_FOUND };
      }
      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return { id: null, next_due_date: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
      if (!settings) {
        return { id: null, next_due_date: null, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
      }

      const overlap = await tx.payments.findFirst({
        where: {
          student_discipline_id: enrollment.id,
          period_start: { lt: parsed.data.period_end },
          period_end: { gt: parsed.data.period_start },
        },
        select: { id: true },
      });
      if (overlap) {
        return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.PERIOD_OVERLAP };
      }

      const payment = await tx.payments.create({
        data: {
          student_discipline_id: enrollment.id,
          amount: parsed.data.amount,
          months_covered: deriveMonthsCovered(parsed.data.period_start, parsed.data.period_end),
          period_start: parsed.data.period_start,
          period_end: parsed.data.period_end,
          payment_date: parsed.data.payment_date ?? formatDateOnly(new Date()),
          recorded_by: ctx.userId,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      const reconciledEnrollment = await tx.student_disciplines.findUnique({
        where: { id: enrollment.id },
        select: { next_due_date: true },
      });
      if (!reconciledEnrollment?.next_due_date) {
        throw new Error("payment reconciliation did not return a due date");
      }

      return {
        id: payment.id,
        next_due_date: formatDatabaseDateOnly(reconciledEnrollment.next_due_date),
        error: null,
      };
    },
    { mapTransactionError: mapPaymentTransactionError }
  );

  if (!result.success) return result;
  if (result.data.id === null || result.data.next_due_date === null) {
    return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
  return { success: true, data: { id: result.data.id, next_due_date: result.data.next_due_date } };
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

      const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
      if (!settings) {
        return { id: null, amount: null, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
      }

      const classPayment = await tx.class_payments.create({
        data: {
          student_discipline_id: enrollment.id,
          amount: classPrice,
          class_date: parsed.data.class_date
            ? parseDateOnly(parsed.data.class_date)
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
 * Validates caller has active branch assignment internally (fail-closed).
 */
export async function getOverdueStudentCount(
  branchId: string
): Promise<ActionResult<number>> {
  if (!branchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branchId);
      if (branchError) {
        return { __branchError: branchError } as const;
      }
      return { count: await countOverdueStudents(tx, branchId) };
    });

    if (!result.success) return result;
    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }
    return { success: true, data: result.data.count };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get list of overdue students with details.
 * Requires validated branchId — callers must resolve context at page level.
 * Validates caller has active branch assignment internally (fail-closed).
 */
export async function getOverdueStudents(
  input: PaymentConsoleFilterInput
): Promise<ActionResult<OverdueStudentRow[]>> {
  const parsed = paymentConsoleFilterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        if (parsed.data.allow_global_admin_read !== true) {
          return { __branchError: branchError } as const;
        }

        const branchRead = await authorizeBranchRead(tx, ctx, parsed.data.branch_id, {
          allowGlobalAdminRead: true,
        });
        if (branchRead.access === BRANCH_READ_ACCESS.DENIED) {
          return { __branchError: branchError } as const;
        }
      }
      return {
        rows: await listOverdueStudents(
          tx,
          parsed.data.branch_id,
          parsed.data.discipline_id
        ),
      };
    });

    if (!result.success) return result;
    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }
    return { success: true, data: result.data.rows };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Gets the current calendar month's payment summary for a validated branch.
 * Read protection mirrors the payment mutation boundary and never accepts a period.
 */
export async function getMonthlyPaymentSummary(
  input: PaymentConsoleFilterInput
): Promise<ActionResult<MonthlyPaymentSummary>> {
  const parsed = paymentConsoleFilterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        if (parsed.data.allow_global_admin_read !== true) {
          return { __branchError: branchError } as const;
        }

        const branchRead = await authorizeBranchRead(tx, ctx, parsed.data.branch_id, {
          allowGlobalAdminRead: true,
        });
        if (branchRead.access === BRANCH_READ_ACCESS.DENIED) {
          return { __branchError: branchError } as const;
        }
      }

      return {
        summary: await getMonthlyPaymentSummaryQuery(
          tx,
          parsed.data.branch_id,
          parsed.data.discipline_id
        ),
      };
    });

    if (!result.success) return result;
    if ("__branchError" in result.data) {
      return {
        success: false,
        error: result.data.__branchError ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }

    return { success: true, data: result.data.summary };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}


export async function correctMonthlyPayment(
  input: CorrectMonthlyPaymentInput
): Promise<ActionResult<{ id: string; next_due_date: string }>> {
  const parsed = correctMonthlyPaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
    if (branchError) return { id: null, next_due_date: null, error: branchError };

    const payment: PaymentResourceRow | null = await tx.payments.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        created_at: true,
        student_discipline_id: true,
        student_disciplines: { select: { students: { select: { branch_id: true } } } },
      },
    });
    if (!payment) return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.PAYMENT_NOT_FOUND };
    if (payment.student_disciplines.students.branch_id !== parsed.data.branch_id) {
      return { id: null, next_due_date: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
    }
    const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
    if (!settings) {
      return { id: null, next_due_date: null, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
    }
    if (!isPaymentCorrectionWithinWindow(payment.created_at, settings.payment_edit_window_days)) {
      return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.CORRECTION_WINDOW_EXCEEDED };
    }

    const overlap = await tx.payments.findFirst({
      where: {
        student_discipline_id: payment.student_discipline_id,
        id: { not: payment.id },
        period_start: { lt: parsed.data.period_end },
        period_end: { gt: parsed.data.period_start },
      },
      select: { id: true },
    });
    if (overlap) return { id: null, next_due_date: null, error: PAYMENT_MESSAGES.PERIOD_OVERLAP };

    await tx.payments.update({
      where: { id: payment.id },
      data: {
        amount: parsed.data.amount,
        months_covered: deriveMonthsCovered(parsed.data.period_start, parsed.data.period_end),
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        payment_date: parsed.data.payment_date ?? formatDateOnly(new Date()),
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    const enrollment = await tx.student_disciplines.findUnique({
      where: { id: payment.student_discipline_id },
      select: { next_due_date: true },
    });
    if (!enrollment?.next_due_date) throw new Error("payment reconciliation did not return a due date");
    return { id: payment.id, next_due_date: formatDatabaseDateOnly(enrollment.next_due_date), error: null };
  }, { mapTransactionError: mapPaymentTransactionError });

  if (!result.success) return result;
  if (result.data.id === null || result.data.next_due_date === null) {
    return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
  return { success: true, data: { id: result.data.id, next_due_date: result.data.next_due_date } };
}

export async function correctClassPayment(
  input: CorrectClassPaymentInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = correctClassPaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
    if (branchError) return { id: null, error: branchError };

    const payment: PaymentResourceRow | null = await tx.class_payments.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        created_at: true,
        student_discipline_id: true,
        student_disciplines: { select: { students: { select: { branch_id: true } } } },
      },
    });
    if (!payment) return { id: null, error: PAYMENT_MESSAGES.PAYMENT_NOT_FOUND };
    if (payment.student_disciplines.students.branch_id !== parsed.data.branch_id) {
      return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
    }
    const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
    if (!settings) {
      return { id: null, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
    }
    if (!isPaymentCorrectionWithinWindow(payment.created_at, settings.payment_edit_window_days)) {
      return { id: null, error: PAYMENT_MESSAGES.CORRECTION_WINDOW_EXCEEDED };
    }

    await tx.class_payments.update({
      where: { id: payment.id },
      data: { amount: parsed.data.amount, class_date: parseDateOnly(parsed.data.class_date) },
      select: { id: true },
    });
    return { id: payment.id, error: null };
  });

  if (!result.success) return result;
  return result.data.id === null
    ? { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR }
    : { success: true, data: { id: result.data.id } };
}

export async function deleteMonthlyPayment(
  input: DeletePaymentInput
): Promise<ActionResult<{ id: string }>> {
  return deletePayment(input, "monthly");
}

export async function deleteClassPayment(
  input: DeletePaymentInput
): Promise<ActionResult<{ id: string }>> {
  return deletePayment(input, "class");
}

const PAYMENT_KIND = {
  MONTHLY: "monthly",
  CLASS: "class",
} as const;
type PaymentKind = (typeof PAYMENT_KIND)[keyof typeof PAYMENT_KIND];

async function deletePayment(
  input: DeletePaymentInput,
  kind: PaymentKind
): Promise<ActionResult<{ id: string }>> {
  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
    if (branchError) return { id: null, error: branchError };

    const payment: PaymentResourceRow | null = kind === PAYMENT_KIND.MONTHLY
      ? await tx.payments.findUnique({
          where: { id: parsed.data.id },
          select: {
            id: true,
            created_at: true,
            student_discipline_id: true,
            student_disciplines: { select: { students: { select: { branch_id: true } } } },
          },
        })
      : await tx.class_payments.findUnique({
          where: { id: parsed.data.id },
          select: {
            id: true,
            created_at: true,
            student_discipline_id: true,
            student_disciplines: { select: { students: { select: { branch_id: true } } } },
          },
        });
    if (!payment) return { id: null, error: PAYMENT_MESSAGES.PAYMENT_NOT_FOUND };
    if (payment.student_disciplines.students.branch_id !== parsed.data.branch_id) {
      return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
    }
    const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
    if (!settings) {
      return { id: null, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
    }
    if (!isPaymentCorrectionWithinWindow(payment.created_at, settings.payment_edit_window_days)) {
      return { id: null, error: PAYMENT_MESSAGES.CORRECTION_WINDOW_EXCEEDED };
    }

    if (kind === PAYMENT_KIND.MONTHLY) {
      await tx.payments.delete({ where: { id: payment.id }, select: { id: true } });
    } else {
      await tx.class_payments.delete({ where: { id: payment.id }, select: { id: true } });
    }
    return { id: payment.id, error: null };
  });

  if (!result.success) return result;
  return result.data.id === null
    ? { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR }
    : { success: true, data: { id: result.data.id } };
}
