"use strict";

import { z } from "zod";

export const PROGRESS_MESSAGES = {
  INVALID_STUDENT_ID: "Identificador de estudiante inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  INVALID_LEVEL: "El nivel especificado no existe.",
  LEVEL_DISCIPLINE_MISMATCH:
    "El nivel no pertenece a la disciplina indicada.",
  PROMOTED_DATE_FORMAT: "La fecha de promoción debe tener formato AAAA-MM-DD.",
  PROMOTED_DATE_INVALID: "La fecha de promoción no es válida.",
  PROMOTED_DATE_NOT_FUTURE: "La fecha de promoción no puede ser futura.",
  OBSERVATIONS_MAX: "Las observaciones no pueden superar 500 caracteres.",
} as const;

export const NOTES_MESSAGES = {
  INVALID_ID: "Identificador de nota inválido.",
  INVALID_STUDENT_ID: "Identificador de estudiante inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  CATEGORY_INVALID:
    "La categoría debe ser una de: tecnica, fisico, actitud, medica, general.",
  CONTENT_REQUIRED: "El contenido es obligatorio.",
  CONTENT_MAX: "El contenido no puede superar 2000 caracteres.",
  ALREADY_COMPLETED: "La nota ya está completada.",
  ALREADY_OPEN: "La nota ya está abierta.",
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  if (year < 1900 || year > 2100) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

function isNotFuture(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr <= todayStr;
}

export const NOTE_CATEGORIES = [
  "tecnica",
  "fisico",
  "actitud",
  "medica",
  "general",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const promoteStudentSchema = z
  .object({
    student_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_STUDENT_ID }),
    discipline_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_DISCIPLINE_ID }),
    level_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_LEVEL }),
    promoted_at: z
      .string()
      .regex(DATE_PATTERN, { error: PROGRESS_MESSAGES.PROMOTED_DATE_FORMAT })
      .refine(isValidCalendarDate, {
        error: PROGRESS_MESSAGES.PROMOTED_DATE_INVALID,
      })
      .refine(isNotFuture, {
        error: PROGRESS_MESSAGES.PROMOTED_DATE_NOT_FUTURE,
      })
      .optional(),
    observations: z
      .string()
      .max(500, { error: PROGRESS_MESSAGES.OBSERVATIONS_MAX })
      .nullable()
      .optional(),
  })
  .strict();

export const readinessQuerySchema = z
  .object({
    student_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_STUDENT_ID }),
    discipline_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_DISCIPLINE_ID }),
    level_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_LEVEL }),
  })
  .strict();

export const progressQuerySchema = z
  .object({
    student_id: z.uuid({ error: PROGRESS_MESSAGES.INVALID_STUDENT_ID }),
  })
  .strict();

export const createNoteSchema = z
  .object({
    student_id: z.uuid({ error: NOTES_MESSAGES.INVALID_STUDENT_ID }),
    discipline_id: z.uuid({ error: NOTES_MESSAGES.INVALID_DISCIPLINE_ID }).nullable().optional(),
    category: z.enum(NOTE_CATEGORIES, {
      error: NOTES_MESSAGES.CATEGORY_INVALID,
    }),
    content: z
      .string()
      .min(1, { error: NOTES_MESSAGES.CONTENT_REQUIRED })
      .max(2000, { error: NOTES_MESSAGES.CONTENT_MAX }),
  })
  .strict();

export const noteActionSchema = z
  .object({
    id: z.uuid({ error: NOTES_MESSAGES.INVALID_ID }),
  })
  .strict();

export const notesQuerySchema = z
  .object({
    student_id: z.uuid({ error: NOTES_MESSAGES.INVALID_STUDENT_ID }),
    discipline_id: z.uuid({ error: NOTES_MESSAGES.INVALID_DISCIPLINE_ID }).nullable().optional(),
    is_completed: z.boolean().optional(),
  })
  .strict();

export type PromoteStudentInput = z.infer<typeof promoteStudentSchema>;
export type ReadinessQueryInput = z.infer<typeof readinessQuerySchema>;
export type ProgressQueryInput = z.infer<typeof progressQuerySchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type NoteActionInput = z.infer<typeof noteActionSchema>;
export type NotesQueryInput = z.infer<typeof notesQuerySchema>;
