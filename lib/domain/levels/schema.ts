"use strict";

import { z } from "zod";

export const LEVEL_MESSAGES = {
  INVALID_ID: "Identificador de nivel inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  NAME_REQUIRED: "El nombre del nivel es obligatorio.",
  NAME_MAX_LENGTH: "El nombre del nivel no puede superar 100 caracteres.",
  COLOR_MAX_LENGTH: "El color no puede superar 30 caracteres.",
  SORT_ORDER_NONNEG: "El orden debe ser un entero mayor o igual a 0.",
  REQUIRED_SESSIONS_NONNEG:
    "Las sesiones requeridas deben ser un entero mayor o igual a 0.",
  SORT_ORDER_TAKEN: "Ya existe un nivel con ese orden en esta disciplina.",
} as const;

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

export type LevelCreateInput = z.infer<typeof levelCreateSchema>;
export type LevelUpdateInput = z.infer<typeof levelUpdateSchema>;
export type LevelsQueryInput = z.infer<typeof levelsQuerySchema>;
