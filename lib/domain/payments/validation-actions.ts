"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchAdmin,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { STUDENT_ACTIVATION_STATUS } from "@/lib/auth/student-identity-resolver";
import { formatDatabaseDateOnly } from "@/lib/date";
import type { TransactionClient } from "@/lib/prisma/client";
import {
  BRANCH_MESSAGES,
  COMMON_MESSAGES,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec";
import { paymentValidationQuerySchema, suspendOverdueEnrollmentsSchema, type PaymentValidationQueryInput, type SuspendOverdueEnrollmentsInput } from "./schema";
import { getBranchLocalToday, normalizeEcuadorTimeZone } from "./queries";
import {
  classifyEnrollment,
  getBranchLocalMonthBounds,
  PAYMENT_VALIDATION_STATUS,
  type EnrollmentPaymentClassification,
  type PaymentValidationStatus,
} from "./validation";

interface ActionSuccess<T> {
  success: true;
  data: T;
}

interface ActionFailure {
  success: false;
  error: string;
}

type ActionResult<T> = ActionSuccess<T> | ActionFailure;

const SUSPENDED_EVENT_TYPE = "suspended";
const NON_PAYMENT_REASON = "non_payment";

const SUSPENSION_COUNT_MISMATCH = "payment validation suspension count mismatch";

export interface MonthlyPaymentValidationRow {
  student_discipline_id: string;
  student_id: string;
  student_name: string;
  discipline_name: string;
  next_due_date: string | null;
  days_overdue: number;
  grace_deadline: string | null;
}

export interface SuspendedThisMonthRow {
  student_discipline_id: string;
  student_id: string;
  student_name: string;
  discipline_name: string;
  suspended_at: string;
  performed_by_name: string | null;
  currently_suspended: boolean;
}

export interface MonthlyPaymentValidationResult {
  today: string;
  month: string;
  grace_days: number;
  up_to_date: MonthlyPaymentValidationRow[];
  in_grace: MonthlyPaymentValidationRow[];
  to_suspend: MonthlyPaymentValidationRow[];
  suspended_this_month: SuspendedThisMonthRow[];
}

interface BranchPaymentSettingsRow {
  payment_grace_days: number;
  time_zone: string | null;
}

interface EnrollmentGroupRow {
  id: string;
  next_due_date: Date | null;
  students: { id: string; first_name: string; surname: string };
  disciplines: { name: string };
}

interface SuspensionEventRow {
  event_date: Date;
  performed_by: string;
  student_discipline_id: string;
  student_disciplines: {
    is_active: boolean;
    student_id: string;
    students: { first_name: string; surname: string };
    disciplines: { name: string };
  };
}

async function getBranchPaymentSettings(
  tx: TransactionClient,
  branchId: string
): Promise<BranchPaymentSettingsRow | null> {
  const rows = await tx.$queryRaw<BranchPaymentSettingsRow[]>`
    SELECT payment_grace_days, time_zone
    FROM public.branches
    WHERE id = ${branchId} AND is_active = true
  `;
  return rows[0] ?? null;
}

/**
 * Resolves user profile display names for the performed_by ids. The
 * user_profiles RLS policy only allows each user to read their own profile,
 * so other users' names resolve to null instead of failing the read.
 */
async function loadUserProfileNames(
  tx: TransactionClient,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  try {
    const profiles = await tx.user_profiles.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, first_name: true, surname: true },
    });

    return new Map(
      profiles.map((profile) => [
        profile.user_id,
        `${profile.first_name} ${profile.surname}`,
      ])
    );
  } catch {
    return new Map();
  }
}

function classifyEnrollmentRow(
  row: EnrollmentGroupRow,
  today: string,
  graceDays: number
): { classification: EnrollmentPaymentClassification; nextDueDate: string | null } {
  const nextDueDate = row.next_due_date ? formatDatabaseDateOnly(row.next_due_date) : null;
  return {
    nextDueDate,
    classification: classifyEnrollment({ nextDueDate, today, graceDays }),
  };
}

/**
 * An active branch admin gets the monthly payment validation view: every
 * active enrollment of the branch classified against the branch-local today
 * plus this month's non-payment suspensions. Read-only.
 */
export async function getMonthlyPaymentValidation(
  input: PaymentValidationQueryInput
): Promise<ActionResult<MonthlyPaymentValidationResult>> {
  const parsed = paymentValidationQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
      if (branchError) {
        return { __error: branchError } as const;
      }

      const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
      if (!settings) {
        return { __error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND } as const;
      }

      const today = await getBranchLocalToday(tx, parsed.data.branch_id);

      const enrollments: EnrollmentGroupRow[] = await tx.student_disciplines.findMany({
        where: {
          is_active: true,
          // Per-class enrollments are never overdue (T8).
          billing_mode: "monthly",
          students: {
            branch_id: parsed.data.branch_id,
            is_active: true,
            activation_status: STUDENT_ACTIVATION_STATUS.ACTIVE,
          },
        },
        select: {
          id: true,
          next_due_date: true,
          students: { select: { id: true, first_name: true, surname: true } },
          disciplines: { select: { name: true } },
        },
      });

      const groups: Record<PaymentValidationStatus, MonthlyPaymentValidationRow[]> = {
        up_to_date: [],
        in_grace: [],
        to_suspend: [],
      };

      for (const enrollment of enrollments) {
        const { nextDueDate, classification } = classifyEnrollmentRow(
          enrollment,
          today,
          settings.payment_grace_days
        );
        groups[classification.status].push({
          student_discipline_id: enrollment.id,
          student_id: enrollment.students.id,
          student_name: `${enrollment.students.first_name} ${enrollment.students.surname}`,
          discipline_name: enrollment.disciplines.name,
          next_due_date: nextDueDate,
          days_overdue: classification.daysOverdue,
          grace_deadline: classification.graceDeadline,
        });
      }

      const byOverdueDesc = (a: MonthlyPaymentValidationRow, b: MonthlyPaymentValidationRow) =>
        b.days_overdue - a.days_overdue || a.student_name.localeCompare(b.student_name);
      groups.to_suspend.sort(byOverdueDesc);
      groups.in_grace.sort(byOverdueDesc);
      groups.up_to_date.sort((a, b) => a.student_name.localeCompare(b.student_name));

      const timeZone = normalizeEcuadorTimeZone(settings.time_zone);
      const { start, end } = getBranchLocalMonthBounds(today, timeZone);

      const suspensionEvents: SuspensionEventRow[] = await tx.discipline_events.findMany({
        where: {
          event_type: SUSPENDED_EVENT_TYPE,
          reason: NON_PAYMENT_REASON,
          event_date: { gte: start, lt: end },
          student_disciplines: { students: { branch_id: parsed.data.branch_id } },
        },
        select: {
          event_date: true,
          performed_by: true,
          student_discipline_id: true,
          student_disciplines: {
            select: {
              is_active: true,
              student_id: true,
              students: { select: { first_name: true, surname: true } },
              disciplines: { select: { name: true } },
            },
          },
        },
        orderBy: { event_date: "desc" },
      });

      const performedByNames = await loadUserProfileNames(
        tx,
        [...new Set(suspensionEvents.map((event) => event.performed_by))]
      );

      const suspendedThisMonth: SuspendedThisMonthRow[] = suspensionEvents.map((event) => ({
        student_discipline_id: event.student_discipline_id,
        student_id: event.student_disciplines.student_id,
        student_name: `${event.student_disciplines.students.first_name} ${event.student_disciplines.students.surname}`,
        discipline_name: event.student_disciplines.disciplines.name,
        suspended_at: event.event_date.toISOString(),
        performed_by_name: performedByNames.get(event.performed_by) ?? null,
        currently_suspended: !event.student_disciplines.is_active,
      }));

      return {
        today,
        month: today.slice(0, 7),
        grace_days: settings.payment_grace_days,
        up_to_date: groups.up_to_date,
        in_grace: groups.in_grace,
        to_suspend: groups.to_suspend,
        suspended_this_month: suspendedThisMonth,
      };
    });

    if (!result.success) return result;
    if ("__error" in result.data) {
      return { success: false, error: result.data.__error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * An active branch admin suspends a batch of overdue enrollments in one
 * atomic transaction. Every enrollment is re-checked against the branch-local
 * today and current grace days; if any check fails nothing is suspended.
 * Each suspension writes `suspended_at` and a 'suspended' discipline event
 * with reason 'non_payment' for audit.
 */
export async function suspendOverdueEnrollments(
  input: SuspendOverdueEnrollmentsInput
): Promise<ActionResult<{ suspended_count: number }>> {
  const parsed = suspendOverdueEnrollmentsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchAdmin(ctx, parsed.data.branch_id);
      if (branchError) {
        return { suspended_count: 0, error: branchError };
      }

      const settings = await getBranchPaymentSettings(tx, parsed.data.branch_id);
      if (!settings) {
        return { suspended_count: 0, error: BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND };
      }

      const today = await getBranchLocalToday(tx, parsed.data.branch_id);

      const enrollments = await tx.student_disciplines.findMany({
        where: { id: { in: parsed.data.student_discipline_ids } },
        select: {
          id: true,
          is_active: true,
          next_due_date: true,
          billing_mode: true,
          students: { select: { branch_id: true, is_active: true, activation_status: true } },
        },
      });

      if (enrollments.length !== parsed.data.student_discipline_ids.length) {
        return { suspended_count: 0, error: PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST };
      }

      const crossBranch = enrollments.some(
        (enrollment) => enrollment.students.branch_id !== parsed.data.branch_id
      );
      if (crossBranch) {
        return { suspended_count: 0, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      const allSuspendable = enrollments.every((enrollment) => {
        // Per-class enrollments are never overdue and never suspendable (T8).
        if (enrollment.billing_mode !== "monthly") return false;
        if (!enrollment.is_active) return false;
        if (!enrollment.students.is_active) return false;
        if (enrollment.students.activation_status !== STUDENT_ACTIVATION_STATUS.ACTIVE) return false;
        const nextDueDate = enrollment.next_due_date
          ? formatDatabaseDateOnly(enrollment.next_due_date)
          : null;
        return (
          classifyEnrollment({ nextDueDate, today, graceDays: settings.payment_grace_days })
            .status === PAYMENT_VALIDATION_STATUS.TO_SUSPEND
        );
      });
      if (!allSuspendable) {
        return { suspended_count: 0, error: PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST };
      }

      const updated = await tx.student_disciplines.updateMany({
        where: { id: { in: parsed.data.student_discipline_ids }, is_active: true },
        data: { is_active: false, suspended_at: new Date() },
      });
      if (updated.count !== parsed.data.student_discipline_ids.length) {
        // Throwing rolls back the transaction; the mapper below turns this
        // into user-facing copy.
        throw new Error(SUSPENSION_COUNT_MISMATCH);
      }

      await tx.discipline_events.createMany({
        data: parsed.data.student_discipline_ids.map((studentDisciplineId) => ({
          student_discipline_id: studentDisciplineId,
          event_type: SUSPENDED_EVENT_TYPE,
          reason: NON_PAYMENT_REASON,
          performed_by: ctx.userId,
          notes: parsed.data.notes ?? null,
        })),
      });

      return { suspended_count: updated.count, error: null };
    },
    {
      mapTransactionError: (error) =>
        error instanceof Error && error.message === SUSPENSION_COUNT_MISMATCH
          ? PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST
          : undefined,
    }
  );

  if (!result.success) return result;
  if (result.data.error) {
    return { success: false, error: result.data.error };
  }
  return { success: true, data: { suspended_count: result.data.suspended_count } };
}
