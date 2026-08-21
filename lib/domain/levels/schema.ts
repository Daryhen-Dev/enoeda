"use strict";

import { z } from "zod";

import { LEVEL_MESSAGES } from "@/lib/localization/es-ec";

export const levelCreateSchema = z
  .object({
    discipline_id: z.uuid({ error: LEVEL_MESSAGES.INVALID_DISCIPLINE_ID }),
    name: z
      .string()
      .min(1, { error: LEVEL_MESSAGES.NAME_REQUIRED })
      .max(100, { error: LEVEL_MESSAGES.NAME_MAX_LENGTH }),
    color: z
      .string()
      .max(30, { error: LEVEL_MESSAGES.COLOR_MAX_LENGTH })
      .nullable()
      .optional(),
    sort_order: z
      .number()
      .int()
      .min(0, { error: LEVEL_MESSAGES.SORT_ORDER_NONNEG }),
    required_attended_sessions: z
      .number()
      .int()
      .min(0, { error: LEVEL_MESSAGES.REQUIRED_SESSIONS_NONNEG })
      .default(0),
  })
  .strict();

export const levelUpdateSchema = z
  .object({
    id: z.uuid({ error: LEVEL_MESSAGES.INVALID_ID }),
    name: z
      .string()
      .min(1, { error: LEVEL_MESSAGES.NAME_REQUIRED })
      .max(100, { error: LEVEL_MESSAGES.NAME_MAX_LENGTH })
      .optional(),
    color: z
      .string()
      .max(30, { error: LEVEL_MESSAGES.COLOR_MAX_LENGTH })
      .nullable()
      .optional(),
    sort_order: z
      .number()
      .int()
      .min(0, { error: LEVEL_MESSAGES.SORT_ORDER_NONNEG })
      .optional(),
    required_attended_sessions: z
      .number()
      .int()
      .min(0, { error: LEVEL_MESSAGES.REQUIRED_SESSIONS_NONNEG })
      .optional(),
  })
  .strict();

export const levelsQuerySchema = z
  .object({
    discipline_id: z.uuid({ error: LEVEL_MESSAGES.INVALID_DISCIPLINE_ID }),
  })
  .strict();

export const setInitialLevelSchema = z
  .object({
    discipline_id: z.uuid({ error: LEVEL_MESSAGES.INVALID_DISCIPLINE_ID }),
    level_id: z.uuid({ error: LEVEL_MESSAGES.INVALID_ID }),
  })
  .strict();

export type LevelCreateInput = z.infer<typeof levelCreateSchema>;
export type LevelUpdateInput = z.infer<typeof levelUpdateSchema>;
export type LevelsQueryInput = z.infer<typeof levelsQuerySchema>;
export type SetInitialLevelInput = z.infer<typeof setInitialLevelSchema>;
