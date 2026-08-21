"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import {
  promoteStudentSchema,
  readinessQuerySchema,
  progressQuerySchema,
  createNoteSchema,
  noteActionSchema,
  notesQuerySchema,
  PROGRESS_MESSAGES,
  NOTES_MESSAGES,
  type PromoteStudentInput,
  type ReadinessQueryInput,
  type ProgressQueryInput,
  type CreateNoteInput,
  type NoteActionInput,
  type NotesQueryInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ReadinessResult {
  attended: number;
  required: number;
  meets_requirement: boolean;
}

export interface PromoteResult extends ReadinessResult {
  id: string;
}

export interface ProgressRecord {
  id: string;
  discipline_id: string;
  discipline_name: string;
  level_id: string;
  level_name: string;
  level_color: string | null;
  promoted_at: Date;
  observations: string | null;
}

export interface StudentProgressSummary {
  discipline_id: string;
  discipline_name: string;
  current_level_id: string | null;
  current_level_name: string | null;
  current_level_color: string | null;
  next_level_id: string | null;
  next_level_name: string | null;
  next_level_color: string | null;
  next_level_required_sessions: number | null;
  period_started_at: Date | null;
  attended_sessions: number;
  is_max_level: boolean;
}

/**
 * Gets the current progression summary for every active enrollment of a student.
 * Attendance is batched across both recurring and one-time classes, and only
 * records linked to a class in the enrolled discipline are counted.
 */
export async function getStudentProgressSummary(
  input: ProgressQueryInput
): Promise<ActionResult<StudentProgressSummary[]>> {
  const parsed = progressQuerySchema.safeParse(input);
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
        select: {
          branch_id: true,
          student_disciplines: {
            where: { is_active: true },
            select: {
              discipline_id: true,
              disciplines: { select: { name: true } },
            },
          },
        },
      });
      if (!student || student.branch_id !== parsed.data.branch_id) {
        return { __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      const enrolledDisciplines = student.student_disciplines;
      const disciplineIds = enrolledDisciplines.map(
        (enrollment) => enrollment.discipline_id
      );
      if (disciplineIds.length === 0) {
        return [];
      }

      const [progressRecords, levels, attendanceRecords] = await Promise.all([
        tx.student_progress.findMany({
          where: {
            student_id: parsed.data.student_id,
            discipline_id: { in: disciplineIds },
          },
          select: {
            id: true,
            discipline_id: true,
            level_id: true,
            promoted_at: true,
            created_at: true,
          },
          orderBy: [
            { promoted_at: "desc" },
            { created_at: "desc" },
            { id: "desc" },
          ],
        }),
        tx.discipline_levels.findMany({
          where: { discipline_id: { in: disciplineIds } },
          select: {
            id: true,
            discipline_id: true,
            name: true,
            color: true,
            sort_order: true,
            required_attended_sessions: true,
          },
          orderBy: [{ discipline_id: "asc" }, { sort_order: "asc" }],
        }),
        tx.attendance.findMany({
          where: {
            student_id: parsed.data.student_id,
            attended: true,
            OR: [
              {
                scheduled_classes: {
                  branch_id: parsed.data.branch_id,
                  discipline_id: { in: disciplineIds },
                },
              },
              {
                one_time_classes: {
                  branch_id: parsed.data.branch_id,
                  discipline_id: { in: disciplineIds },
                },
              },
            ],
          },
          select: {
            session_date: true,
            scheduled_classes: { select: { discipline_id: true } },
            one_time_classes: { select: { discipline_id: true } },
          },
        }),
      ]);

      const currentProgressByDiscipline = new Map<
        string,
        (typeof progressRecords)[number]
      >();
      for (const record of progressRecords) {
        if (!currentProgressByDiscipline.has(record.discipline_id)) {
          currentProgressByDiscipline.set(record.discipline_id, record);
        }
      }

      const levelsByDiscipline = new Map<
        string,
        Array<(typeof levels)[number]>
      >();
      for (const level of levels) {
        const disciplineLevels = levelsByDiscipline.get(level.discipline_id) ?? [];
        disciplineLevels.push(level);
        levelsByDiscipline.set(level.discipline_id, disciplineLevels);
      }

      const attendedByDiscipline = new Map<string, number>();
      for (const attendance of attendanceRecords) {
        const disciplineId =
          attendance.scheduled_classes?.discipline_id ??
          attendance.one_time_classes?.discipline_id;
        if (!disciplineId) continue;

        const currentProgress = currentProgressByDiscipline.get(disciplineId);
        if (
          currentProgress &&
          attendance.session_date >= currentProgress.promoted_at
        ) {
          attendedByDiscipline.set(
            disciplineId,
            (attendedByDiscipline.get(disciplineId) ?? 0) + 1
          );
        }
      }

      return enrolledDisciplines.map((enrollment) => {
        const currentProgress = currentProgressByDiscipline.get(
          enrollment.discipline_id
        );
        const disciplineLevels =
          levelsByDiscipline.get(enrollment.discipline_id) ?? [];
        const currentLevelIndex = currentProgress
          ? disciplineLevels.findIndex(
              (level) => level.id === currentProgress.level_id
            )
          : -1;
        const currentLevel =
          currentLevelIndex >= 0 ? disciplineLevels[currentLevelIndex] : null;
        const nextLevel =
          currentLevelIndex >= 0
            ? (disciplineLevels[currentLevelIndex + 1] ?? null)
            : null;

        return {
          discipline_id: enrollment.discipline_id,
          discipline_name: enrollment.disciplines.name,
          current_level_id: currentLevel?.id ?? null,
          current_level_name: currentLevel?.name ?? null,
          current_level_color: currentLevel?.color ?? null,
          next_level_id: nextLevel?.id ?? null,
          next_level_name: nextLevel?.name ?? null,
          next_level_color: nextLevel?.color ?? null,
          next_level_required_sessions:
            nextLevel?.required_attended_sessions ?? null,
          period_started_at: currentProgress?.promoted_at ?? null,
          attended_sessions:
            currentProgress === undefined
              ? 0
              : (attendedByDiscipline.get(enrollment.discipline_id) ?? 0),
          is_max_level: currentLevel !== null && nextLevel === null,
        } satisfies StudentProgressSummary;
      });
    });

    if (!result.success) return result;
    if ("__branchError" in result.data) {
      return {
        success: false,
        error: (result.data as { __branchError: string }).__branchError,
      };
    }

    return { success: true, data: result.data as StudentProgressSummary[] };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

export interface NoteRecord {
  id: string;
  discipline_id: string | null;
  category: string;
  content: string;
  is_completed: boolean;
  completed_at: Date | null;
  completed_by: string | null;
  created_by: string;
  created_at: Date;
}

/**
 * Get promotion readiness: attended sessions vs. required for a target level.
 * Read-only preview for the admin promotion dialog indicator.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function getPromotionReadiness(
  input: ReadinessQueryInput
): Promise<ActionResult<ReadinessResult>> {
  const parsed = readinessQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, discipline_id, level_id, branch_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { error: branchError } as const;
      }

      // Validate student belongs to branch
      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return { error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      // Load target level
      const level = await tx.discipline_levels.findUnique({
        where: { id: level_id },
        select: { discipline_id: true, required_attended_sessions: true },
      });
      if (!level) {
        return { error: PROGRESS_MESSAGES.INVALID_LEVEL } as const;
      }
      if (level.discipline_id !== discipline_id) {
        return { error: PROGRESS_MESSAGES.LEVEL_DISCIPLINE_MISMATCH } as const;
      }

      // Get last promotion boundary
      const last = await tx.student_progress.findFirst({
        where: { student_id, discipline_id },
        orderBy: { promoted_at: "desc" },
        select: { promoted_at: true },
      });

      // Count attended sessions since last promotion
      const attended = await tx.attendance.count({
        where: {
          student_id,
          attended: true,
          scheduled_classes: { discipline_id },
          ...(last ? { session_date: { gt: last.promoted_at } } : {}),
        },
      });

      const required = level.required_attended_sessions;
      const meets_requirement = attended >= required;

      return { attended, required, meets_requirement, error: null } as const;
    });

    if (!result.success) return result;
    if ("error" in result.data && result.data.error) {
      return { success: false, error: result.data.error };
    }

    const { attended, required, meets_requirement } = result.data as {
      attended: number;
      required: number;
      meets_requirement: boolean;
      error: null;
    };
    return { success: true, data: { attended, required, meets_requirement } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Promote a student to a level. Admin/Owner only via RLS (policy 6d/6e).
 * Informative: promotion always succeeds regardless of meets_requirement.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function promoteStudent(
  input: PromoteStudentInput
): Promise<ActionResult<PromoteResult>> {
  const parsed = promoteStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, discipline_id, level_id, branch_id, promoted_at, observations } =
    parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { error: branchError } as const;
      }

      // Validate student belongs to branch
      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return { error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      // Load target level
      const level = await tx.discipline_levels.findUnique({
        where: { id: level_id },
        select: { discipline_id: true, required_attended_sessions: true },
      });
      if (!level) {
        return { error: PROGRESS_MESSAGES.INVALID_LEVEL } as const;
      }
      if (level.discipline_id !== discipline_id) {
        return { error: PROGRESS_MESSAGES.LEVEL_DISCIPLINE_MISMATCH } as const;
      }

      // Last promotion boundary
      const last = await tx.student_progress.findFirst({
        where: { student_id, discipline_id },
        orderBy: { promoted_at: "desc" },
        select: { promoted_at: true },
      });

      // Count attended sessions
      const attended = await tx.attendance.count({
        where: {
          student_id,
          attended: true,
          scheduled_classes: { discipline_id },
          ...(last ? { session_date: { gt: last.promoted_at } } : {}),
        },
      });

      const required = level.required_attended_sessions;
      const meets_requirement = attended >= required;

      // INSERT (regardless of meets_requirement)
      const record = await tx.student_progress.create({
        data: {
          student_id,
          discipline_id,
          level_id,
          promoted_at: promoted_at
            ? new Date(promoted_at + "T00:00:00")
            : undefined,
          observations: observations ?? null,
          created_by: ctx.userId,
        },
        select: { id: true },
      });

      return {
        id: record.id,
        attended,
        required,
        meets_requirement,
        error: null,
      } as const;
    });

    if (!result.success) return result;
    if ("error" in result.data && result.data.error) {
      return { success: false, error: result.data.error };
    }

    const { id, attended, required, meets_requirement } = result.data as {
      id: string;
      attended: number;
      required: number;
      meets_requirement: boolean;
      error: null;
    };
    return {
      success: true,
      data: { id, attended, required, meets_requirement },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * List all progress records for a student (all disciplines).
 * Ordered by promoted_at desc. Current level = first row per discipline group.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function listProgress(
  input: ProgressQueryInput
): Promise<ActionResult<ProgressRecord[]>> {
  const parsed = progressQuerySchema.safeParse(input);
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

      return tx.student_progress.findMany({
        where: { student_id: parsed.data.student_id },
        select: {
          id: true,
          discipline_id: true,
          level_id: true,
          promoted_at: true,
          observations: true,
          disciplines: { select: { name: true } },
          discipline_levels: { select: { name: true, color: true } },
        },
        orderBy: { promoted_at: "desc" },
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }

    const rows = result.data as Exclude<typeof result.data, { __branchError: string }>;
    const records: ProgressRecord[] = rows.map((row) => ({
      id: row.id,
      discipline_id: row.discipline_id,
      discipline_name: row.disciplines.name,
      level_id: row.level_id,
      level_name: row.discipline_levels.name,
      level_color: row.discipline_levels.color,
      promoted_at: row.promoted_at,
      observations: row.observations,
    }));

    return { success: true, data: records };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Create a note for a student. Admin/Teacher branch-scoped via RLS.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function createNote(
  input: CreateNoteInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      // Validate student belongs to branch
      const student = await tx.students.findUnique({
        where: { id: parsed.data.student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== parsed.data.branch_id) {
        return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      const note = await tx.student_notes.create({
        data: {
          student_id: parsed.data.student_id,
          discipline_id: parsed.data.discipline_id ?? null,
          category: parsed.data.category,
          content: parsed.data.content,
          created_by: ctx.userId,
        },
        select: { id: true },
      });

      return { id: note.id, error: null } as const;
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
 * Mark a note as completed.
 * Requires branch context; validates note's student belongs to caller's branch.
 */
export async function completeNote(
  input: NoteActionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = noteActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      const note = await tx.student_notes.findUnique({
        where: { id: parsed.data.id },
        select: { id: true, is_completed: true, student_id: true, students: { select: { branch_id: true } } },
      });
      if (!note) {
        return { id: null, error: NOTES_MESSAGES.INVALID_ID } as const;
      }

      // Validate note's student belongs to the requested branch
      if (note.students.branch_id !== parsed.data.branch_id) {
        return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      if (note.is_completed) {
        return { id: null, error: NOTES_MESSAGES.ALREADY_COMPLETED } as const;
      }

      await tx.student_notes.update({
        where: { id: note.id },
        data: {
          is_completed: true,
          completed_at: new Date(),
          completed_by: ctx.userId,
        },
      });

      return { id: note.id, error: null } as const;
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

/**
 * Reopen a completed note.
 * Requires branch context; validates note's student belongs to caller's branch.
 */
export async function reopenNote(
  input: NoteActionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = noteActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch context validation
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      const note = await tx.student_notes.findUnique({
        where: { id: parsed.data.id },
        select: { id: true, is_completed: true, student_id: true, students: { select: { branch_id: true } } },
      });
      if (!note) {
        return { id: null, error: NOTES_MESSAGES.INVALID_ID } as const;
      }

      // Validate note's student belongs to the requested branch
      if (note.students.branch_id !== parsed.data.branch_id) {
        return { id: null, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      if (!note.is_completed) {
        return { id: null, error: NOTES_MESSAGES.ALREADY_OPEN } as const;
      }

      await tx.student_notes.update({
        where: { id: note.id },
        data: {
          is_completed: false,
          completed_at: null,
          completed_by: null,
        },
      });

      return { id: note.id, error: null } as const;
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

/**
 * List notes for a student with optional discipline/completion filters.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function listNotes(
  input: NotesQueryInput
): Promise<ActionResult<NoteRecord[]>> {
  const parsed = notesQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, branch_id, discipline_id, is_completed } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return { __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
      }

      return tx.student_notes.findMany({
        where: {
          student_id,
          ...(discipline_id !== undefined && { discipline_id }),
          ...(is_completed !== undefined && { is_completed }),
        },
        select: {
          id: true,
          discipline_id: true,
          category: true,
          content: true,
          is_completed: true,
          completed_at: true,
          completed_by: true,
          created_by: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }

    return { success: true, data: result.data as NoteRecord[] };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
