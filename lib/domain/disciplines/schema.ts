import {
  DISCIPLINE_MESSAGES,
  ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Discipline validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a YYYY-MM-DD string represents a real calendar date.
 * Rejects Feb 30, Apr 31, etc. without UTC reinterpretation issues.
 */
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

/**
 * Validates that a YYYY-MM-DD string is not in the future.
 */
function isNotFuture(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr <= todayStr;
}

export const disciplineIdSchema = z.uuid({
  error: DISCIPLINE_MESSAGES.INVALID_ID,
});

export const disciplineCreateSchema = z.object({
  name: z
    .string()
    .min(1, { error: DISCIPLINE_MESSAGES.NAME_REQUIRED })
    .max(100, { error: DISCIPLINE_MESSAGES.NAME_MAX_LENGTH }),
  code: z
    .string()
    .min(1, { error: DISCIPLINE_MESSAGES.CODE_REQUIRED })
    .max(50, { error: DISCIPLINE_MESSAGES.CODE_MAX_LENGTH })
    .regex(/^[a-z0-9-]+$/, { error: DISCIPLINE_MESSAGES.CODE_FORMAT }),
});

export const enrollStudentSchema = z.object({
  student_id: z.uuid({ error: DISCIPLINE_MESSAGES.INVALID_ID }),
  discipline_ids: z
    .array(z.uuid())
    .min(1, { error: ENROLLMENT_MESSAGES.MIN_ONE_DISCIPLINE }),
  branch_id: z.uuid({ error: ENROLLMENT_MESSAGES.BRANCH_REQUIRED }),
  enrolled_at: z
    .string()
    .regex(DATE_PATTERN, { error: ENROLLMENT_MESSAGES.DATE_FORMAT })
    .refine(isValidCalendarDate, { error: ENROLLMENT_MESSAGES.INVALID_DATE })
    .refine(isNotFuture, { error: ENROLLMENT_MESSAGES.DATE_NOT_FUTURE })
    .optional(),
});

export const enrollmentActionSchema = z.object({
  student_discipline_id: z.uuid(),
  branch_id: z.uuid({ error: ENROLLMENT_MESSAGES.BRANCH_REQUIRED }),
  notes: z.string().max(500).optional(),
});

export const studentDisciplinesQuerySchema = z.object({
  student_id: z.uuid(),
  branch_id: z.uuid({ error: ENROLLMENT_MESSAGES.BRANCH_REQUIRED }),
});

export const activeDisciplinesForBranchSchema = z.object({
  branch_id: z.uuid({ error: ENROLLMENT_MESSAGES.BRANCH_REQUIRED }),
});

export type ActiveDisciplinesForBranchInput = z.infer<
  typeof activeDisciplinesForBranchSchema
>;

export type DisciplineCreateInput = z.infer<typeof disciplineCreateSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type EnrollmentActionInput = z.infer<typeof enrollmentActionSchema>;
