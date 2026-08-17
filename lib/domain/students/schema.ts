import { STUDENT_MESSAGES } from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Student validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const studentIdSchema = z.uuid({ error: STUDENT_MESSAGES.INVALID_ID });

/**
 * Validates that a YYYY-MM-DD string represents a real calendar date.
 * Rejects Feb 30, Apr 31, etc. without UTC reinterpretation issues.
 * Parses components as integers and validates against actual month lengths.
 */
function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // Month must be 1-12
  if (month < 1 || month > 12) return false;

  // Day must be at least 1
  if (day < 1) return false;

  // Year must be reasonable (not year 0 or negative, not far future)
  if (year < 1900 || year > 2100) return false;

  // Determine days in the given month (handles leap years)
  // Using Date(year, month, 0).getDate() gives last day of that month
  const daysInMonth = new Date(year, month, 0).getDate();

  return day <= daysInMonth;
}

export const studentCreateSchema = z.object({
  branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
  first_name: z
    .string()
    .min(1, { error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
    .max(100, { error: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH }),
  surname: z
    .string()
    .min(1, { error: STUDENT_MESSAGES.SURNAME_REQUIRED })
    .max(100, { error: STUDENT_MESSAGES.SURNAME_MAX_LENGTH }),
  national_id: z
    .string()
    .min(1, { error: STUDENT_MESSAGES.NATIONAL_ID_REQUIRED })
    .max(30, { error: STUDENT_MESSAGES.NATIONAL_ID_MAX_LENGTH }),
  email: z.email({ error: STUDENT_MESSAGES.INVALID_EMAIL }),
  date_of_birth: z
    .string()
    .regex(DATE_PATTERN, { error: STUDENT_MESSAGES.DATE_OF_BIRTH_FORMAT })
    .refine(isValidCalendarDate, {
      error: STUDENT_MESSAGES.INVALID_DATE_OF_BIRTH,
    }),
  is_active: z.boolean().default(true),
});

export const STUDENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type StudentStatus =
  (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

export const studentListSchema = z
  .object({
    branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
    cursor: studentIdSchema.optional(),
    page_size: z.number().int().min(1).max(100).default(25),
    status: z
      .enum([STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INACTIVE])
      .default(STUDENT_STATUS.ACTIVE),
  })
  .strict();

export const studentReactivateSchema = z
  .object({
    id: studentIdSchema,
    branch_id: z
      .uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID })
      .optional(),
  })
  .strict();

export const studentUpdateSchema = z
  .object({
    id: studentIdSchema,
    branch_id: z
      .uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID })
      .optional(),
    first_name: z
      .string()
      .min(1, { error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH })
      .optional(),
    surname: z
      .string()
      .min(1, { error: STUDENT_MESSAGES.SURNAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.SURNAME_MAX_LENGTH })
      .optional(),
    national_id: z
      .string()
      .min(1, { error: STUDENT_MESSAGES.NATIONAL_ID_REQUIRED })
      .max(30, { error: STUDENT_MESSAGES.NATIONAL_ID_MAX_LENGTH })
      .optional(),
    email: z.email({ error: STUDENT_MESSAGES.INVALID_EMAIL }).optional(),
    date_of_birth: z
      .string()
      .regex(DATE_PATTERN, { error: STUDENT_MESSAGES.DATE_OF_BIRTH_FORMAT })
      .refine(isValidCalendarDate, {
        error: STUDENT_MESSAGES.INVALID_DATE_OF_BIRTH,
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.branch_id !== undefined ||
      data.first_name !== undefined ||
      data.surname !== undefined ||
      data.national_id !== undefined ||
      data.email !== undefined ||
      data.date_of_birth !== undefined,
    { error: STUDENT_MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED }
  );

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentListInput = z.infer<typeof studentListSchema>;
export type StudentReactivateInput = z.infer<typeof studentReactivateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
