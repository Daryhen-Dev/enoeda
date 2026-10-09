"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import {
  authorizeBranchRead,
  BRANCH_READ_ACCESS,
} from "@/lib/auth/branch-read-access";
import {
  COMMON_MESSAGES,
  DISCIPLINE_MESSAGES,
  ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  activeDisciplinesForBranchSchema,
  disciplineCreateSchema,
  enrollStudentSchema,
  enrollmentActionSchema,
  setEnrollmentBillingModeSchema,
  studentDisciplinesQuerySchema,
  type ActiveDisciplinesForBranchInput,
  type DisciplineCreateInput,
  type EnrollStudentInput,
  type EnrollmentActionInput,
  type SetEnrollmentBillingModeInput,
} from "./schema";
import { removeStudentFromCurrentAndFutureRosters } from "@/lib/domain/rosters/cleanup";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DisciplineRecord {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface DisciplineFilterOption {
  id: string;
  name: string;
}

export interface StudentDisciplineRecord {
  id: string;
  discipline_id: string;
  discipline_name: string;
  enrolled_at: Date;
  is_active: boolean;
  suspended_at: Date | null;
  billing_mode: "monthly" | "per_class";
}

export interface EnrollmentEvent {
  id: string;
  event_type: "enrolled" | "suspended" | "reactivated";
  performed_by: string;
  event_date: Date;
  notes: string | null;
}

/**
 * List all disciplines in the catalog.
 * Any authenticated role can read (RLS enforced).
 */
export async function listDisciplines(
  input?: unknown
): Promise<ActionResult<DisciplineRecord[]>> {
  // input is optional — no validation needed for a simple list
  void input;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.disciplines.findMany({
        where: { is_active: true },
        select: { id: true, name: true, code: true, is_active: true },
        orderBy: { name: "asc" },
      });
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: DISCIPLINE_MESSAGES.LOAD_FAILURE };
  }
}

/**
 * Lists active catalog disciplines after validating the selected branch and
 * caller branch access. Catalog entries are independent of student enrollments.
 */
export async function listActiveDisciplinesForBranch(
  input: ActiveDisciplinesForBranchInput
): Promise<ActionResult<DisciplineFilterOption[]>> {
  const parsed = activeDisciplinesForBranchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        if (parsed.data.allow_global_admin_read !== true) {
          return { records: [], error: branchError };
        }

        const branchRead = await authorizeBranchRead(tx, ctx, parsed.data.branch_id, {
          allowGlobalAdminRead: true,
        });
        if (branchRead.access === BRANCH_READ_ACCESS.DENIED) {
          return { records: [], error: branchError };
        }
      }

      const rows = await tx.disciplines.findMany({
        where: { is_active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return { records: rows, error: null };
    });

    if (!result.success) return result;
    if (result.data.error) {
      return { success: false, error: result.data.error };
    }

    return { success: true, data: result.data.records };
  } catch {
    return { success: false, error: DISCIPLINE_MESSAGES.LOAD_FAILURE };
  }
}

/**
 * Get disciplines for a specific student.
 * Any authenticated role can read (RLS scopes rows by branch).
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function getStudentDisciplines(
  input: { student_id: string; branch_id: string }
): Promise<ActionResult<StudentDisciplineRecord[]>> {
  const parsed = studentDisciplinesQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
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

      return tx.student_disciplines.findMany({
        where: { student_id: parsed.data.student_id },
        select: {
          id: true,
          discipline_id: true,
          enrolled_at: true,
          is_active: true,
          suspended_at: true,
          billing_mode: true,
          disciplines: { select: { name: true } },
        },
        orderBy: { enrolled_at: "desc" },
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }

    const rows = result.data as Exclude<typeof result.data, { __branchError: string }>;
    const records: StudentDisciplineRecord[] = rows.map((row) => ({
      id: row.id,
      discipline_id: row.discipline_id,
      discipline_name: row.disciplines.name,
      enrolled_at: row.enrolled_at,
      is_active: row.is_active,
      suspended_at: row.suspended_at,
      billing_mode: row.billing_mode === "per_class" ? "per_class" : "monthly",
    }));

    return { success: true, data: records };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get full enrollment history for a student.
 * Returns all events across all discipline enrollments.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function getEnrollmentHistory(
  input: { student_id: string; branch_id: string }
): Promise<ActionResult<EnrollmentEvent[]>> {
  const parsed = studentDisciplinesQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      const student = await tx.students.findUnique({
        where: { id: parsed.data.student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== parsed.data.branch_id) {
        return { __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      return tx.discipline_events.findMany({
        where: {
          student_disciplines: { student_id: parsed.data.student_id },
        },
        select: {
          id: true,
          event_type: true,
          performed_by: true,
          event_date: true,
          notes: true,
        },
        orderBy: { event_date: "asc" },
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }

    const rows = result.data as Exclude<typeof result.data, { __branchError: string }>;
    const events: EnrollmentEvent[] = rows.map((row) => ({
      id: row.id,
      event_type: row.event_type as EnrollmentEvent["event_type"],
      performed_by: row.performed_by,
      event_date: row.event_date,
      notes: row.notes,
    }));

    return { success: true, data: events };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Create a new discipline. Owner-only (RLS enforced).
 */
export async function createDiscipline(
  input: DisciplineCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = disciplineCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.disciplines.create({
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
        },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("disciplines_name_uq")) {
        return { success: false, error: DISCIPLINE_MESSAGES.NAME_ALREADY_EXISTS };
      }
      if (error.message.includes("disciplines_code_uq")) {
        return { success: false, error: DISCIPLINE_MESSAGES.CODE_ALREADY_EXISTS };
      }
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Enroll a student in one or more disciplines.
 * Owner/Admin-branch via RLS. Batch is atomic.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function enrollStudent(
  input: EnrollStudentInput
): Promise<ActionResult<{ enrolled: number }>> {
  const parsed = enrollStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, discipline_ids, enrolled_at, branch_id, billing_mode } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { enrolled: 0, error: branchError };
      }

      // Validate student belongs to branch
      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return { enrolled: 0, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      let enrolledCount = 0;

      for (const discipline_id of discipline_ids) {
        const enrollment = await tx.student_disciplines.create({
          data: {
            student_id,
            discipline_id,
            enrolled_at: enrolled_at ? new Date(enrolled_at) : undefined,
            is_active: true,
            billing_mode,
          },
          select: {
            id: true,
            disciplines: { select: { initial_level_id: true } },
          },
        });

        await tx.discipline_events.create({
          data: {
            student_discipline_id: enrollment.id,
            event_type: "enrolled",
            performed_by: ctx.userId,
          },
        });

        if (enrollment.disciplines?.initial_level_id) {
          await tx.student_progress.create({
            data: {
              student_id,
              discipline_id,
              level_id: enrollment.disciplines.initial_level_id,
              created_by: ctx.userId,
            },
          });
        }

        enrolledCount++;
      }

      return { enrolled: enrolledCount, error: null };
    });

    if (!result.success) return result;
    if (result.data.error) {
      return { success: false, error: result.data.error };
    }
    return { success: true, data: { enrolled: result.data.enrolled } };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("student_disciplines_pair_uq")
    ) {
      return { success: false, error: ENROLLMENT_MESSAGES.ALREADY_ENROLLED };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Suspend an active enrollment.
 * Owner/Admin-branch via RLS.
 * Requires branch context; validates enrollment belongs to caller's branch.
 * Also removes the student from the current/future rosters of that
 * discipline (the roster eligibility trigger only checks on insert) and
 * reports the removed count without breaking existing callers.
 */
export async function suspendEnrollment(
  input: EnrollmentActionInput
): Promise<ActionResult<{ id: string; removed_roster_entries: number }>> {
  const parsed = enrollmentActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: {
          id: true,
          is_active: true,
          student_id: true,
          discipline_id: true,
          students: { select: { branch_id: true } },
        },
      });

      if (!enrollment) {
        return { id: null, error: ENROLLMENT_MESSAGES.NOT_FOUND };
      }

      // Validate enrollment belongs to the requested branch
      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      if (!enrollment.is_active) {
        return { id: null, error: ENROLLMENT_MESSAGES.ALREADY_SUSPENDED };
      }

      await tx.student_disciplines.update({
        where: { id: enrollment.id },
        data: { is_active: false, suspended_at: new Date() },
      });
      // The roster eligibility trigger only checks on insert, so stale
      // current/future roster rows must be cleaned at application level.
      const removedRosterEntries = await removeStudentFromCurrentAndFutureRosters(
        tx,
        {
          branchId: parsed.data.branch_id,
          studentId: enrollment.student_id,
          disciplineId: enrollment.discipline_id,
        }
      );

      await tx.discipline_events.create({
        data: {
          student_discipline_id: enrollment.id,
          event_type: "suspended",
          reason: "manual",
          performed_by: ctx.userId,
          notes: parsed.data.notes ?? null,
        },
      });

      return { id: enrollment.id, removed_roster_entries: removedRosterEntries, error: null };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }

    return {
      success: true,
      data: {
        id: result.data.id,
        removed_roster_entries: result.data.removed_roster_entries,
      },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Set the billing mode of one enrollment (student × discipline).
 * Branch admin or owner only; the enrollment must belong to the branch.
 * Switching monthly -> per_class removes the student from the current and
 * future rosters of that discipline (the DB trigger only checks on insert)
 * and clears next_due_date, which stays NULL for per-class students.
 * Switching per_class -> monthly keeps next_due_date NULL until the first
 * monthly payment reconciles it. Every change is audited with a
 * 'billing_mode_changed' discipline event whose reason is the new mode.
 */
export async function setEnrollmentBillingMode(
  input: SetEnrollmentBillingModeInput
): Promise<
  ActionResult<{ billing_mode: "monthly" | "per_class"; removed_roster_entries: number }>
> {
  const parsed = setEnrollmentBillingModeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation — owners have global reach and skip the
      // per-branch assignment assertion (same rule as roster writes).
      const isOwner = ctx.roles.includes("owner");
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError && !isOwner) {
        return {
          billing_mode: null,
          removed_roster_entries: 0,
          error: branchError,
        };
      }

      // Branch admin or owner only (teachers are read-only).
      const isBranchAdmin = ctx.assignments.some(
        (assignment) =>
          assignment.role === "admin" &&
          assignment.branchId === parsed.data.branch_id
      );
      if (!isBranchAdmin && !isOwner) {
        return {
          billing_mode: null,
          removed_roster_entries: 0,
          error: ENROLLMENT_MESSAGES.BILLING_MODE_UNAUTHORIZED,
        };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: {
          id: true,
          student_id: true,
          discipline_id: true,
          billing_mode: true,
          students: { select: { branch_id: true } },
        },
      });

      if (!enrollment) {
        return {
          billing_mode: null,
          removed_roster_entries: 0,
          error: ENROLLMENT_MESSAGES.NOT_FOUND,
        };
      }

      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return {
          billing_mode: null,
          removed_roster_entries: 0,
          error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
        };
      }

      if (enrollment.billing_mode === parsed.data.billing_mode) {
        return {
          billing_mode: parsed.data.billing_mode,
          removed_roster_entries: 0,
          error: null,
        };
      }

      let removedRosterEntries = 0;
      if (parsed.data.billing_mode === "per_class") {
        removedRosterEntries = await removeStudentFromCurrentAndFutureRosters(
          tx,
          {
            branchId: parsed.data.branch_id,
            studentId: enrollment.student_id,
            disciplineId: enrollment.discipline_id,
          }
        );
      }

      await tx.student_disciplines.update({
        where: { id: enrollment.id },
        data: {
          billing_mode: parsed.data.billing_mode,
          next_due_date: null,
        },
      });

      await tx.discipline_events.create({
        data: {
          student_discipline_id: enrollment.id,
          event_type: "billing_mode_changed",
          reason: parsed.data.billing_mode,
          performed_by: ctx.userId,
        },
      });

      return {
        billing_mode: parsed.data.billing_mode,
        removed_roster_entries: removedRosterEntries,
        error: null,
      };
    });

    if (!result.success) return result;
    if (result.data.billing_mode === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }
    return {
      success: true,
      data: {
        billing_mode: result.data.billing_mode,
        removed_roster_entries: result.data.removed_roster_entries,
      },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Reactivate a suspended enrollment.
 * Owner/Admin-branch via RLS.
 * Requires branch context; validates enrollment belongs to caller's branch.
 */
export async function reactivateEnrollment(
  input: EnrollmentActionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = enrollmentActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError };
      }

      const enrollment = await tx.student_disciplines.findUnique({
        where: { id: parsed.data.student_discipline_id },
        select: { id: true, is_active: true, student_id: true, students: { select: { branch_id: true } } },
      });

      if (!enrollment) {
        return { id: null, error: ENROLLMENT_MESSAGES.NOT_FOUND };
      }

      // Validate enrollment belongs to the requested branch
      if (enrollment.students.branch_id !== parsed.data.branch_id) {
        return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
      }

      if (enrollment.is_active) {
        return { id: null, error: ENROLLMENT_MESSAGES.ALREADY_ACTIVE };
      }

      await tx.student_disciplines.update({
        where: { id: enrollment.id },
        data: { is_active: true, suspended_at: null },
      });

      await tx.discipline_events.create({
        data: {
          student_discipline_id: enrollment.id,
          event_type: "reactivated",
          performed_by: ctx.userId,
          notes: parsed.data.notes ?? null,
        },
      });

      return { id: enrollment.id, error: null };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }

    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
