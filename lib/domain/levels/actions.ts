"use server";

import { withAuthenticatedUser, type AuthenticatedContext } from "@/lib/auth/server-context";
import { assertCallerBranchAdmin } from "@/lib/auth/branch-assertion";
import {
  COMMON_MESSAGES,
  DISCIPLINE_MESSAGES,
  LEVEL_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  buildBranchRequirementMap,
  resolveRequiredSessions,
} from "./branch-requirements";
import {
  branchLevelRequirementsQuerySchema,
  clearBranchLevelRequirementSchema,
  levelCreateSchema,
  levelUpdateSchema,
  levelsQuerySchema,
  setBranchLevelRequirementSchema,
  setInitialLevelSchema,
  type BranchLevelRequirementsQueryInput,
  type ClearBranchLevelRequirementInput,
  type LevelCreateInput,
  type LevelUpdateInput,
  type LevelsQueryInput,
  type SetBranchLevelRequirementInput,
  type SetInitialLevelInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LevelRecord {
  id: string;
  discipline_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  required_attended_sessions: number;
}

export interface DisciplineLevelCatalog {
  initial_level_id: string | null;
  levels: LevelRecord[];
}

/**
 * Get all levels for a discipline, ordered by sort_order ascending.
 * Any authenticated user can read (RLS USING true).
 */
export async function getLevels(
  input: LevelsQueryInput
): Promise<ActionResult<LevelRecord[]>> {
  const parsed = levelsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.discipline_levels.findMany({
        where: { discipline_id: parsed.data.discipline_id },
        select: {
          id: true,
          discipline_id: true,
          name: true,
          color: true,
          sort_order: true,
          required_attended_sessions: true,
        },
        orderBy: { sort_order: "asc" },
      });
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/** Get a discipline's initial-level configuration and ordered catalog together. */
export async function getDisciplineLevelCatalog(
  input: LevelsQueryInput
): Promise<ActionResult<DisciplineLevelCatalog>> {
  const parsed = levelsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const [discipline, levels] = await Promise.all([
        tx.disciplines.findUnique({
          where: { id: parsed.data.discipline_id },
          select: { initial_level_id: true },
        }),
        tx.discipline_levels.findMany({
          where: { discipline_id: parsed.data.discipline_id },
          select: {
            id: true,
            discipline_id: true,
            name: true,
            color: true,
            sort_order: true,
            required_attended_sessions: true,
          },
          orderBy: { sort_order: "asc" },
        }),
      ]);

      return { discipline, levels };
    });

    if (!result.success) return result;
    if (!result.data.discipline) {
      return { success: false, error: DISCIPLINE_MESSAGES.NOT_FOUND };
    }

    return {
      success: true,
      data: {
        initial_level_id: result.data.discipline.initial_level_id,
        levels: result.data.levels,
      },
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/** Create a level for a discipline. Owner-only (RLS enforced). */
export async function createLevel(
  input: LevelCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = levelCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.discipline_levels.create({
        data: {
          discipline_id: parsed.data.discipline_id,
          name: parsed.data.name,
          color: parsed.data.color ?? null,
          sort_order: parsed.data.sort_order,
          required_attended_sessions: parsed.data.required_attended_sessions,
        },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("discipline_levels_discipline_sort_uq")
    ) {
      return { success: false, error: LEVEL_MESSAGES.SORT_ORDER_TAKEN };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/** Update an existing level. Owner-only (RLS enforced). */
export async function updateLevel(
  input: LevelUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = levelUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...fields } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.discipline_levels.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.color !== undefined && { color: fields.color }),
          ...(fields.sort_order !== undefined && {
            sort_order: fields.sort_order,
          }),
          ...(fields.required_attended_sessions !== undefined && {
            required_attended_sessions: fields.required_attended_sessions,
          }),
        },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("discipline_levels_discipline_sort_uq")
    ) {
      return { success: false, error: LEVEL_MESSAGES.SORT_ORDER_TAKEN };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/** Set the explicitly configured initial level for a discipline. Owner-only. */
export async function setInitialLevel(
  input: SetInitialLevelInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = setInitialLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      if (!ctx.roles.includes("owner")) {
        return { id: null, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
      }

      const [discipline, level] = await Promise.all([
        tx.disciplines.findUnique({
          where: { id: parsed.data.discipline_id },
          select: { id: true },
        }),
        tx.discipline_levels.findUnique({
          where: { id: parsed.data.level_id },
          select: { discipline_id: true },
        }),
      ]);

      if (!discipline) {
        return { id: null, error: DISCIPLINE_MESSAGES.NOT_FOUND };
      }
      if (!level) {
        return { id: null, error: LEVEL_MESSAGES.NOT_FOUND };
      }
      if (level.discipline_id !== discipline.id) {
        return { id: null, error: LEVEL_MESSAGES.DISCIPLINE_MISMATCH };
      }

      const updated = await tx.disciplines.update({
        where: { id: discipline.id },
        data: { initial_level_id: parsed.data.level_id },
        select: { id: true },
      });
      return { id: updated.id, error: null };
    });

    if (!result.success) return result;
    if (result.data.error || !result.data.id) {
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

// --- Branch-scoped belt promotion requirements ---

export interface BranchLevelRequirementView {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  /** Owner-managed value that applies when there is no branch override. */
  general_required: number;
  /** This branch's override, or null when the general value applies. */
  branch_required: number | null;
  /**
   * Last change of the requirement that currently applies: the override's
   * updated_at when one exists, otherwise the level's own updated_at.
   */
  updated_at: Date;
  /** What promotion actually requires on this branch. */
  effective_required: number;
}

export interface DisciplineBranchLevelRequirements {
  discipline_id: string;
  discipline_name: string;
  levels: BranchLevelRequirementView[];
}

/**
 * Owners manage every branch; branch admins manage only their own branch.
 * Teachers are rejected with the shared insufficient-permissions message.
 */
function assertBranchLevelRequirementAccess(
  ctx: AuthenticatedContext,
  branchId: string
): string | null {
  if (ctx.roles.includes("owner")) return null;
  const adminError = assertCallerBranchAdmin(ctx, branchId);
  return adminError ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS : null;
}

/**
 * List every active discipline's levels with general vs branch-specific
 * promotion requirements. Owner or branch-admin only (also enforced by RLS).
 */
export async function listBranchLevelRequirements(
  input: BranchLevelRequirementsQueryInput
): Promise<ActionResult<DisciplineBranchLevelRequirements[]>> {
  const parsed = branchLevelRequirementsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const denied = assertBranchLevelRequirementAccess(
        ctx,
        parsed.data.branch_id
      );
      if (denied) {
        return { __error: denied, __disciplines: null } as const;
      }

      const [disciplines, overrides] = await Promise.all([
        tx.disciplines.findMany({
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            discipline_levels: {
              select: {
                id: true,
                name: true,
                color: true,
                sort_order: true,
                required_attended_sessions: true,
                updated_at: true,
              },
              orderBy: { sort_order: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
        tx.branch_level_requirements.findMany({
          where: { branch_id: parsed.data.branch_id },
          select: {
            branch_id: true,
            level_id: true,
            required_attended_sessions: true,
            updated_at: true,
          },
        }),
      ]);

      const overridesByLevel = buildBranchRequirementMap(
        overrides,
        parsed.data.branch_id
      );

      return {
        __error: null,
        __disciplines: disciplines.map((discipline) => ({
          discipline_id: discipline.id,
          discipline_name: discipline.name,
          levels: discipline.discipline_levels.map((level) => {
            const override = overridesByLevel.get(level.id) ?? null;
            return {
              id: level.id,
              name: level.name,
              color: level.color,
              sort_order: level.sort_order,
              general_required: level.required_attended_sessions,
              branch_required: override?.required ?? null,
              /** Last change of the requirement that currently applies. */
              updated_at: (
                override ?? {
                  updated_at: level.updated_at,
                }
              ).updated_at,
              effective_required: resolveRequiredSessions(
                level.required_attended_sessions,
                override?.required ?? null
              ),
            };
          }),
        })),
      } as const;
    });

    if (!result.success) return result;
    if (result.data.__error || !result.data.__disciplines) {
      return {
        success: false,
        error: result.data.__error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }
    return { success: true, data: result.data.__disciplines };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Upsert this branch's required-sessions override for a level.
 * Owner or branch-admin only; the (branch_id, level_id) pair scopes the row
 * so no admin can affect another branch.
 */
export async function setBranchLevelRequirement(
  input: SetBranchLevelRequirementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = setBranchLevelRequirementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, level_id, required_attended_sessions } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const denied = assertBranchLevelRequirementAccess(ctx, branch_id);
      if (denied) {
        return { id: null, error: denied } as const;
      }

      const level = await tx.discipline_levels.findUnique({
        where: { id: level_id },
        select: { id: true },
      });
      if (!level) {
        return { id: null, error: LEVEL_MESSAGES.NOT_FOUND } as const;
      }

      const row = await tx.branch_level_requirements.upsert({
        where: { branch_id_level_id: { branch_id, level_id } },
        create: {
          branch_id,
          level_id,
          required_attended_sessions,
          updated_by: ctx.userId,
        },
        update: {
          required_attended_sessions,
          updated_by: ctx.userId,
        },
        select: { id: true },
      });
      return { id: row.id, error: null } as const;
    });

    if (!result.success) return result;
    if (!result.data.id) {
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
 * Remove this branch's override for a level so the general (owner) value
 * applies again. Configuration data, not history: the row is deleted.
 * Idempotent — clearing a missing override succeeds. Owner or branch-admin.
 */
export async function clearBranchLevelRequirement(
  input: ClearBranchLevelRequirementInput
): Promise<ActionResult<{ branch_id: string; level_id: string }>> {
  const parsed = clearBranchLevelRequirementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, level_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const denied = assertBranchLevelRequirementAccess(ctx, branch_id);
      if (denied) {
        return { __error: denied } as const;
      }

      await tx.branch_level_requirements.deleteMany({
        where: { branch_id, level_id },
      });
      return { __error: null } as const;
    });

    if (!result.success) return result;
    if (result.data.__error) {
      return { success: false, error: result.data.__error };
    }
    return { success: true, data: { branch_id, level_id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
