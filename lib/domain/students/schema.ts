import { STUDENT_DIRECTORY_MESSAGES, STUDENT_MESSAGES } from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Student validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const studentPhoneSchema = z
  .string()
  .max(30, { error: STUDENT_MESSAGES.PHONE_MAX_LENGTH })
  .nullish()
  .transform((value) => (value === "" ? null : value));

const studentCreatePhoneSchema = studentPhoneSchema.transform((value) =>
  value === undefined ? null : value
);

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

/**
 * A date of birth cannot be in the future. Compared against the UTC
 * date-only value: UTC is never behind Ecuador time, so this never
 * rejects a birth date that is today or earlier for the branch.
 */
function isFutureDate(dateStr: string): boolean {
  const now = new Date();
  const todayDateOnly =
    `${now.getUTCFullYear()}`.padStart(4, "0") +
    `-${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `-${String(now.getUTCDate()).padStart(2, "0")}`;

  return dateStr > todayDateOnly;
}

/** Optional national id: trimmed; blank stored as null; validated when present. */
const studentNationalIdSchema = z
  .string()
  .trim()
  .max(30, { error: STUDENT_MESSAGES.NATIONAL_ID_MAX_LENGTH })
  .transform((value) => (value === "" ? null : value));

/** Optional email: trimmed; blank stored as null; validated when present. */
const studentEmailSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) =>
      value === null ||
      z.email({ error: STUDENT_MESSAGES.INVALID_EMAIL }).safeParse(value).success,
    { error: STUDENT_MESSAGES.INVALID_EMAIL }
  );

/** Optional date of birth: trimmed; blank stored as null; validated when present. */
const studentDateOfBirthSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || DATE_PATTERN.test(value), {
    error: STUDENT_MESSAGES.DATE_OF_BIRTH_FORMAT,
  })
  .refine((value) => value === null || isValidCalendarDate(value), {
    error: STUDENT_MESSAGES.INVALID_DATE_OF_BIRTH,
  })
  .refine((value) => value === null || !isFutureDate(value), {
    error: STUDENT_MESSAGES.DATE_OF_BIRTH_FUTURE,
  });

export const studentCreateSchema = z.object({
  branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
  first_name: z
    .string()
    .trim()
    .min(1, { error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
    .max(100, { error: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH }),
  surname: z
    .string()
    .trim()
    .min(1, { error: STUDENT_MESSAGES.SURNAME_REQUIRED })
    .max(100, { error: STUDENT_MESSAGES.SURNAME_MAX_LENGTH }),
  national_id: studentNationalIdSchema.nullish().transform((value) => value ?? null),
  email: studentEmailSchema.nullish().transform((value) => value ?? null),
  phone: studentCreatePhoneSchema,
  date_of_birth: studentDateOfBirthSchema.nullish().transform((value) => value ?? null),
  is_active: z.boolean().default(true),
});

export const STUDENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type StudentStatus =
  (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

export const STUDENT_ACTIVATION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
} as const;

export const studentActivationStatusSchema = z.enum([
  STUDENT_ACTIVATION_STATUS.PENDING,
  STUDENT_ACTIVATION_STATUS.ACTIVE,
]);

export type StudentActivationStatus =
  (typeof STUDENT_ACTIVATION_STATUS)[keyof typeof STUDENT_ACTIVATION_STATUS];

export const studentListSchema = z
  .object({
    branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
    cursor: studentIdSchema.optional(),
    page_size: z.number().int().min(1).max(100).default(25),
    status: z
      .enum([STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INACTIVE])
      .default(STUDENT_STATUS.ACTIVE),
    query: z
      .string({ error: STUDENT_DIRECTORY_MESSAGES.INVALID_FILTER })
      .trim()
      .max(100, { error: STUDENT_DIRECTORY_MESSAGES.QUERY_MAX_LENGTH })
      .transform((value) => value.replace(/\s+/g, " "))
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    discipline_id: z
      .uuid({ error: STUDENT_DIRECTORY_MESSAGES.INVALID_DISCIPLINE_ID })
      .optional(),
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

/**
 * Duplicate-name warning lookup (create flow): same first name AND surname
 * within one branch. Names are normalized like the stored value (trim,
 * collapse inner whitespace); case-insensitivity is delegated to Prisma
 * `mode: "insensitive"`.
 */
export const STUDENT_DUPLICATE_NAME_LIMIT = 5;

export const studentDuplicateNameSchema = z
  .object({
    branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
    first_name: z
      .string({ error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
      .trim()
      .min(1, { error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH })
      .transform((value) => value.replace(/\s+/g, " ")),
    surname: z
      .string({ error: STUDENT_MESSAGES.SURNAME_REQUIRED })
      .trim()
      .min(1, { error: STUDENT_MESSAGES.SURNAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.SURNAME_MAX_LENGTH })
      .transform((value) => value.replace(/\s+/g, " ")),
  })
  .strict();

export type StudentDuplicateNameInput = z.infer<typeof studentDuplicateNameSchema>;

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
    national_id: studentNationalIdSchema.nullish(),
    email: studentEmailSchema.nullish(),
    phone: studentPhoneSchema,
    date_of_birth: studentDateOfBirthSchema.nullish(),
  })
  .refine(
    (data) =>
      data.branch_id !== undefined ||
      data.first_name !== undefined ||
      data.surname !== undefined ||
      data.national_id !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.date_of_birth !== undefined,
    { error: STUDENT_MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED }
  );

export type StudentCreateInput = z.input<typeof studentCreateSchema>;
export type StudentListInput = z.infer<typeof studentListSchema>;
export type StudentReactivateInput = z.infer<typeof studentReactivateSchema>;
export type StudentUpdateInput = z.input<typeof studentUpdateSchema>;
