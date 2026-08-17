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
