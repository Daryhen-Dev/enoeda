"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import {
  levelCreateSchema,
  levelUpdateSchema,
  levelsQuerySchema,
  LEVEL_MESSAGES,
  type LevelCreateInput,
  type LevelUpdateInput,
  type LevelsQueryInput,
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

/**
 * Create a level for a discipline. Owner-only (RLS enforced).
 */
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

/**
 * Update an existing level. Owner-only (RLS enforced).
 */
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
