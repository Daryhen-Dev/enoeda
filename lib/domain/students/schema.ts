import { z } from "zod";

/**
 * Student validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const studentIdSchema = z.string().uuid("Invalid student ID");

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
  branch_id: z.string().uuid("Invalid branch ID"),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or less"),
  surname: z
    .string()
    .min(1, "Surname is required")
    .max(100, "Surname must be 100 characters or less"),
  national_id: z
    .string()
    .min(1, "National ID is required")
    .max(30, "National ID must be 30 characters or less"),
  email: z.string().email("Invalid email address"),
  date_of_birth: z
    .string()
    .regex(DATE_PATTERN, "Date of birth must be YYYY-MM-DD format")
    .refine(isValidCalendarDate, "Date of birth is not a valid calendar date"),
  is_active: z.boolean().default(true),
});

export const studentUpdateSchema = z.object({
  id: studentIdSchema,
  branch_id: z.string().uuid("Invalid branch ID").optional(),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or less")
    .optional(),
  surname: z
    .string()
    .min(1, "Surname is required")
    .max(100, "Surname must be 100 characters or less")
    .optional(),
  national_id: z
    .string()
    .min(1, "National ID is required")
    .max(30, "National ID must be 30 characters or less")
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  date_of_birth: z
    .string()
    .regex(DATE_PATTERN, "Date of birth must be YYYY-MM-DD format")
    .refine(isValidCalendarDate, "Date of birth is not a valid calendar date")
    .optional(),
  is_active: z.boolean().optional(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
