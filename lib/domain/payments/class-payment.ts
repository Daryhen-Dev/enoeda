/**
 * Shared class-payment creation logic for per-class charges bound to a
 * class occurrence (a weekday scheduled class session or a one-time class).
 *
 * Used by registerClassPayment (admin/teacher console) and by
 * addPerClassStudentToSession (attendance inline payment, T6).
 *
 * This module is intentionally NOT a "use server" module: it holds internal
 * transaction helpers and must never expose server-action endpoints.
 */
import { BRANCH_ASSERTION_MESSAGES } from "@/lib/auth/branch-assertion";
import type { TransactionClient } from "@/lib/prisma/client";
import { BRANCH_MESSAGES, PAYMENT_MESSAGES } from "@/lib/localization/es-ec";

/** Partial unique indexes from migration 20260910000000. */
export const CLASS_PAYMENT_OCCURRENCE_UNIQUE_INDEXES = [
  "class_payments_scheduled_occurrence_uq",
  "class_payments_one_time_occurrence_uq",
] as const;

export interface BranchPaymentSettingsRow {
  payment_due_day: number;
  payment_edit_window_days: number;
}

/**
 * Payment configuration for an active branch (due day, correction window).
 * Returns null when the branch is missing or inactive.
 */
export async function getBranchPaymentSettings(
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

export interface CreateClassPaymentForOccurrenceParams {
  tx: TransactionClient;
  student_discipline_id: string;
  branch_id: string;
  recorded_by: string;
  /** Occurrence date (session date); defaults to today via the DB. */
  class_date?: Date;
  scheduled_class_id?: string | null;
  one_time_class_id?: string | null;
}

export type ClassPaymentCreationResult =
  | { ok: true; id: string; amount: number }
  | { ok: false; error: string };

/**
 * Creates a class_payments row priced from disciplines.class_price for the
 * given enrollment and occurrence. Fails without writing when:
 * - the enrollment does not exist (ENROLLMENT_NOT_FOUND),
 * - it belongs to another branch (CROSS_BRANCH_DENIED),
 * - the discipline has no class_price (CLASS_PRICE_NOT_SET),
 * - the branch is inactive/missing (INACTIVE_OR_NOT_FOUND),
 * - the student was already charged for this occurrence (ALREADY_PAID,
 *   mapped from the partial unique indexes).
 * Unknown errors are rethrown so the surrounding transaction can roll back.
 */
export async function createClassPaymentForOccurrence(
  params: CreateClassPaymentForOccurrenceParams
): Promise<ClassPaymentCreationResult> {
  const { tx, student_discipline_id, branch_id, recorded_by } = params;

  const enrollment = await tx.student_disciplines.findUnique({
    where: { id: student_discipline_id },
    select: {
      id: true,
      disciplines: { select: { class_price: true } },
      students: { select: { branch_id: true } },
    },
  });

  if (!enrollment) {
    return { ok: false, error: PAYMENT_MESSAGES.ENROLLMENT_NOT_FOUND };
  }

  if (enrollment.students.branch_id !== branch_id) {
    return { ok: false, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
  }

  const classPrice = enrollment.disciplines.class_price;
  if (classPrice === null || classPrice === undefined) {
    return { ok: false, error: PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET };
  }

  const settings = await getBranchPaymentSettings(tx, branch_id);
  if (!settings) {
    return { ok: false, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
  }

  try {
    const classPayment = await tx.class_payments.create({
      data: {
        student_discipline_id,
        amount: classPrice,
        class_date: params.class_date,
        scheduled_class_id: params.scheduled_class_id ?? null,
        one_time_class_id: params.one_time_class_id ?? null,
        recorded_by,
      },
      select: { id: true, amount: true },
    });

    return { ok: true, id: classPayment.id, amount: Number(classPayment.amount) };
  } catch (error) {
    if (
      error instanceof Error &&
      CLASS_PAYMENT_OCCURRENCE_UNIQUE_INDEXES.some((index) =>
        error.message.includes(index)
      )
    ) {
      return { ok: false, error: PAYMENT_MESSAGES.ALREADY_PAID };
    }
    throw error;
  }
}
