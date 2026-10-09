"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import type { AuthenticatedContext } from "@/lib/auth/server-context";
import { assertActiveBranchAssignment } from "@/lib/auth/assert-branch-assignment";
import type { TransactionClient } from "@/lib/prisma/client";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  ROSTER_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  addStudentsToRosterSchema,
  listClassRosterSchema,
  listRosterCandidatesSchema,
  removeStudentFromRosterSchema,
} from "./schema";
import {
  classifyRosterEligibility,
  type RosterEligibilityStatus,
} from "./eligibility";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- View types ---

export interface RosterStudentRow {
  student_id: string;
  first_name: string;
  surname: string;
  national_id: string;
  /** ISO timestamp of when the student was added to the roster. */
  added_at: string;
}

export interface RosterCandidateRow {
  student_id: string;
  first_name: string;
  surname: string;
  national_id: string;
}

export type RosterSkipReason = Extract<
  RosterEligibilityStatus,
  "branch_mismatch" | "inactive" | "not_eligible"
> | "already_assigned";

export interface AddStudentsToRosterResult {
  added: string[];
  skipped: Array<{
    student_id: string;
    reason: RosterSkipReason;
  }>;
}

export interface RemoveStudentFromRosterResult {
  removed: boolean;
}

// --- Helpers ---

type RosterTarget = {
  kind: "series";
  targetId: string;
  disciplineId: string;
} | {
  kind: "one_time";
  targetId: string;
  disciplineId: string;
};

/**
 * Resolve the roster target (series or one-time class) inside the
 * RLS-bound transaction. Scoping the lookup by branch_id makes a foreign
 * target indistinguishable from an absent one: both yield NOT_FOUND.
 */
async function resolveRosterTarget(
  tx: TransactionClient,
  target: { kind: string; series_id?: string; one_time_class_id?: string },
  branchId: string
): Promise<RosterTarget | null> {
  if (target.kind === "series" && target.series_id) {
    const row = await tx.class_series.findFirst({
      where: { id: target.series_id, branch_id: branchId },
      select: { discipline_id: true },
    });
    if (!row) return null;
    return {
      kind: "series",
      targetId: target.series_id,
      disciplineId: row.discipline_id,
    };
  }
  if (target.kind === "one_time" && target.one_time_class_id) {
    const row = await tx.one_time_classes.findFirst({
      where: { id: target.one_time_class_id, branch_id: branchId },
      select: { discipline_id: true },
    });
    if (!row) return null;
    return {
      kind: "one_time",
      targetId: target.one_time_class_id,
      disciplineId: row.discipline_id,
    };
  }
  return null;
}

/**
 * Roster write authorization: admin of the branch (owner passes through
 * the RLS owner policy even without a branch-admin assignment). Teachers
 * have read-only roster access.
 */
type RosterWriteAccessResult =
  | { ok: true; branchId: string }
  | { ok: false; error: string };

function assertRosterWriteAccess(
  ctx: AuthenticatedContext,
  branchId: string
): RosterWriteAccessResult {
  const branchCheck = assertActiveBranchAssignment(ctx, branchId);
  if (branchCheck.ok) {
    const isAdmin = ctx.assignments.some(
      (assignment) =>
        assignment.role === "admin" && assignment.branchId === branchId
    );
    if (isAdmin) {
      return branchCheck;
    }
    return { ok: false, error: ROSTER_MESSAGES.UNAUTHORIZED };
  }
  if (ctx.roles.includes("owner")) {
    return { ok: true, branchId };
  }
  return branchCheck;
}

/**
 * Keep known, expected guard failures as user-facing copy; everything
 * else falls back to the generic unexpected-error message.
 */
function mapRosterActionError(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    (error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
      error.message === ROSTER_MESSAGES.NOT_FOUND ||
      error.message === ROSTER_MESSAGES.UNAUTHORIZED ||
      error.message.includes("permisos"))
  ) {
    return error.message;
  }
  return undefined;
}

/**
 * Safety net for DB-trigger rejections (race between the app-side
 * eligibility pre-check and the insert): map each stable trigger message
 * prefix from private.assert_roster_eligibility to its user-facing copy.
 */
const ROSTER_TRIGGER_ERROR_MESSAGES: ReadonlyArray<
  readonly [prefix: string, message: string]
> = [
  ["roster_student_branch_mismatch", ROSTER_MESSAGES.SKIPPED_BRANCH_MISMATCH],
  ["roster_student_inactive", ROSTER_MESSAGES.SKIPPED_INACTIVE],
  ["roster_student_not_eligible", ROSTER_MESSAGES.SKIPPED_NOT_ELIGIBLE],
];

function mapRosterWriteError(error: unknown): string | undefined {
  if (error instanceof Error) {
    for (const [prefix, message] of ROSTER_TRIGGER_ERROR_MESSAGES) {
      if (error.message.startsWith(prefix)) {
        return message;
      }
    }
  }
  return mapRosterActionError(error);
}

// --- Server Actions ---

/**
 * Students currently assigned to the roster of a monthly class group
 * (class_series) or a one-time class, ordered by surname, then first_name.
 * Removing a roster row elsewhere never touches attendance history.
 * Owner/Admin-branch/Teacher-branch via RLS.
 */
export async function listClassRoster(
  input: unknown
): Promise<ActionResult<{ students: RosterStudentRow[] }>> {
  const parsed = listClassRosterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      const target = await resolveRosterTarget(tx, parsed.data, branch_id);
      if (!target) {
        throw new Error(ROSTER_MESSAGES.NOT_FOUND);
      }

      const rows =
        target.kind === "series"
          ? await tx.class_series_students.findMany({
              where: { series_id: target.targetId },
              select: {
                student_id: true,
                created_at: true,
                students: {
                  select: { first_name: true, surname: true, national_id: true },
                },
              },
              orderBy: [
                { students: { surname: "asc" } },
                { students: { first_name: "asc" } },
              ],
            })
          : await tx.one_time_class_students.findMany({
              where: { one_time_class_id: target.targetId },
              select: {
                student_id: true,
                created_at: true,
                students: {
                  select: { first_name: true, surname: true, national_id: true },
                },
              },
              orderBy: [
                { students: { surname: "asc" } },
                { students: { first_name: "asc" } },
              ],
            });

      return {
        students: rows.map((row) => ({
          student_id: row.student_id,
          first_name: row.students.first_name,
          surname: row.students.surname,
          national_id: row.students.national_id,
          added_at: row.created_at.toISOString(),
        })),
      };
    }, { mapTransactionError: mapRosterActionError });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Roster candidates: active students of the branch with an active
 * monthly-billed enrollment in the target's discipline who are NOT already
 * on the roster (same rules as the DB trigger, applied app-side). The
 * optional search matches first_name/surname/national_id
 * case-insensitively; the result is limited to 50 students ordered by
 * surname, then first_name.
 * Owner/Admin-branch/Teacher-branch via RLS.
 */
export async function listRosterCandidates(
  input: unknown
): Promise<ActionResult<{ students: RosterCandidateRow[] }>> {
  const parsed = listRosterCandidatesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, search } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      const target = await resolveRosterTarget(tx, parsed.data, branch_id);
      if (!target) {
        throw new Error(ROSTER_MESSAGES.NOT_FOUND);
      }

      // Students already on the roster are excluded.
      const assigned =
        target.kind === "series"
          ? await tx.class_series_students.findMany({
              where: { series_id: target.targetId },
              select: { student_id: true },
            })
          : await tx.one_time_class_students.findMany({
              where: { one_time_class_id: target.targetId },
              select: { student_id: true },
            });
      const assignedIds = new Set(assigned.map((row) => row.student_id));

      // Active monthly enrollments in the target's discipline.
      const enrollments = await tx.student_disciplines.findMany({
        where: {
          discipline_id: target.disciplineId,
          is_active: true,
          billing_mode: "monthly",
        },
        select: { student_id: true },
      });
      const candidateIds = enrollments
        .map((row) => row.student_id)
        .filter((studentId) => !assignedIds.has(studentId));

      if (candidateIds.length === 0) {
        return { students: [] };
      }

      const students = await tx.students.findMany({
        where: {
          id: { in: candidateIds },
          branch_id,
          is_active: true,
          ...(search
            ? {
                OR: [
                  { first_name: { contains: search, mode: "insensitive" } },
                  { surname: { contains: search, mode: "insensitive" } },
                  { national_id: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: { id: true, first_name: true, surname: true, national_id: true },
        orderBy: [{ surname: "asc" }, { first_name: "asc" }],
        take: 50,
      });

      return {
        students: students.map((student) => ({
          student_id: student.id,
          first_name: student.first_name,
          surname: student.surname,
          national_id: student.national_id,
        })),
      };
    }, { mapTransactionError: mapRosterActionError });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Add students to the roster of a monthly class group or one-time class.
 * Eligibility is pre-checked in the app (same rules as the DB trigger) so
 * a single bad student never aborts the batch; eligible students are
 * inserted in ONE transaction with added_by = caller. Trigger message
 * prefixes are mapped as a safety net against pre-check/insert races.
 * Owner/Admin-branch via RLS (teachers are read-only).
 */
export async function addStudentsToRoster(
  input: unknown
): Promise<ActionResult<AddStudentsToRosterResult>> {
  const parsed = addStudentsToRosterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, student_ids } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion + roster write authorization
      const writeCheck = assertRosterWriteAccess(ctx, branch_id);
      if (!writeCheck.ok) {
        throw new Error(writeCheck.error);
      }

      const target = await resolveRosterTarget(tx, parsed.data, branch_id);
      if (!target) {
        throw new Error(ROSTER_MESSAGES.NOT_FOUND);
      }

      const students = await tx.students.findMany({
        where: { id: { in: student_ids } },
        select: { id: true, branch_id: true, is_active: true },
      });
      const enrollments = await tx.student_disciplines.findMany({
        where: {
          student_id: { in: student_ids },
          discipline_id: target.disciplineId,
        },
        select: { student_id: true, is_active: true, billing_mode: true },
      });
      const assigned =
        target.kind === "series"
          ? await tx.class_series_students.findMany({
              where: {
                series_id: target.targetId,
                student_id: { in: student_ids },
              },
              select: { student_id: true },
            })
          : await tx.one_time_class_students.findMany({
              where: {
                one_time_class_id: target.targetId,
                student_id: { in: student_ids },
              },
              select: { student_id: true },
            });

      const studentById = new Map(
        students.map((s) => [
          s.id,
          { student_id: s.id, branch_id: s.branch_id, is_active: s.is_active },
        ])
      );
      const enrollmentByStudentId = new Map(
        enrollments.map((e) => [e.student_id, e])
      );
      const assignedIds = new Set(assigned.map((row) => row.student_id));

      const added: string[] = [];
      const skipped: AddStudentsToRosterResult["skipped"] = [];
      for (const studentId of student_ids) {
        if (assignedIds.has(studentId)) {
          skipped.push({ student_id: studentId, reason: "already_assigned" });
          continue;
        }
        // An absent student row mirrors the DB trigger: NULL branch →
        // roster_student_branch_mismatch.
        const status = classifyRosterEligibility(
          studentById.get(studentId) ?? null,
          enrollmentByStudentId.get(studentId) ?? null,
          branch_id
        );
        if (status === "eligible") {
          added.push(studentId);
        } else {
          skipped.push({
            student_id: studentId,
            reason: status as RosterSkipReason,
          });
        }
      }

      if (added.length > 0) {
        if (target.kind === "series") {
          await tx.class_series_students.createMany({
            data: added.map((studentId) => ({
              series_id: target.targetId,
              student_id: studentId,
              added_by: ctx.userId,
            })),
          });
        } else {
          await tx.one_time_class_students.createMany({
            data: added.map((studentId) => ({
              one_time_class_id: target.targetId,
              student_id: studentId,
              added_by: ctx.userId,
            })),
          });
        }
      }

      return { added, skipped };
    }, { mapTransactionError: mapRosterWriteError });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Remove a student from the roster of a monthly class group or one-time
 * class. Soft by design for history: only the roster row is deleted —
 * attendance, sessions and payments are never touched.
 * Owner/Admin-branch via RLS (teachers are read-only).
 */
export async function removeStudentFromRoster(
  input: unknown
): Promise<ActionResult<RemoveStudentFromRosterResult>> {
  const parsed = removeStudentFromRosterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, student_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion + roster write authorization
      const writeCheck = assertRosterWriteAccess(ctx, branch_id);
      if (!writeCheck.ok) {
        throw new Error(writeCheck.error);
      }

      const target = await resolveRosterTarget(tx, parsed.data, branch_id);
      if (!target) {
        throw new Error(ROSTER_MESSAGES.NOT_FOUND);
      }

      const deleted =
        target.kind === "series"
          ? await tx.class_series_students.deleteMany({
              where: { series_id: target.targetId, student_id },
            })
          : await tx.one_time_class_students.deleteMany({
              where: { one_time_class_id: target.targetId, student_id },
            });

      return { removed: deleted.count > 0 };
    }, { mapTransactionError: mapRosterActionError });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
