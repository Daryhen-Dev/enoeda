import { z } from "zod";

import { CONDUCT_MESSAGES, ROSTER_MESSAGES } from "@/lib/localization/es-ec";

export const CONDUCT_KINDS = {
  FINE: "fine",
  WARNING: "warning",
} as const;

export type ConductKind = (typeof CONDUCT_KINDS)[keyof typeof CONDUCT_KINDS];

export const CONDUCT_STATUSES = {
  PENDING: "pending",
  PAID: "paid",
  ISSUED: "issued",
} as const;

export type ConductStatus = (typeof CONDUCT_STATUSES)[keyof typeof CONDUCT_STATUSES];

/** Matches the numeric(10, 2) column bound in the migration. */
export const MAX_FINE_AMOUNT = 99999999.99;

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

function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

const incidentDateSchema = z
  .string()
  .regex(DATE_PATTERN, { error: CONDUCT_MESSAGES.INCIDENT_DATE_FORMAT })
  .refine(isValidCalendarDate, {
    error: CONDUCT_MESSAGES.INCIDENT_DATE_INVALID,
  })
  .refine(isNotFuture, {
    error: CONDUCT_MESSAGES.INCIDENT_DATE_NOT_FUTURE,
  })
  .optional();

const fineAmountSchema = z
  .number({ error: CONDUCT_MESSAGES.AMOUNT_POSITIVE })
  .positive({ error: CONDUCT_MESSAGES.AMOUNT_POSITIVE })
  .max(MAX_FINE_AMOUNT, { error: CONDUCT_MESSAGES.AMOUNT_MAX })
  .refine(hasAtMostTwoDecimals, { error: CONDUCT_MESSAGES.AMOUNT_DECIMALS });

export const createConductRecordSchema = z.discriminatedUnion("kind", [
  z
    .object({
      student_id: z.uuid({ error: CONDUCT_MESSAGES.INVALID_STUDENT_ID }),
      branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
      kind: z.literal(CONDUCT_KINDS.FINE, {
        error: CONDUCT_MESSAGES.KIND_INVALID,
      }),
      reason: z
        .string()
        .trim()
        .min(1, { error: CONDUCT_MESSAGES.REASON_REQUIRED })
        .max(2000, { error: CONDUCT_MESSAGES.REASON_MAX }),
      incident_date: incidentDateSchema,
      amount: fineAmountSchema,
    })
    .strict(),
  z
    .object({
      student_id: z.uuid({ error: CONDUCT_MESSAGES.INVALID_STUDENT_ID }),
      branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
      kind: z.literal(CONDUCT_KINDS.WARNING, {
        error: CONDUCT_MESSAGES.KIND_INVALID,
      }),
      reason: z
        .string()
        .trim()
        .min(1, { error: CONDUCT_MESSAGES.REASON_REQUIRED })
        .max(2000, { error: CONDUCT_MESSAGES.REASON_MAX }),
      incident_date: incidentDateSchema,
      // Zod 4: absent or explicitly undefined both pass; a present value
      // fails with the friendly copy.
      amount: z
        .optional(z.undefined({ error: CONDUCT_MESSAGES.AMOUNT_NOT_ALLOWED })),
    })
    .strict(),
]);

export const conductRecordActionSchema = z
  .object({
    id: z.uuid({ error: CONDUCT_MESSAGES.INVALID_ID }),
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
  })
  .strict();

export const voidConductRecordSchema = z
  .object({
    id: z.uuid({ error: CONDUCT_MESSAGES.INVALID_ID }),
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
    void_reason: z
      .string()
      .trim()
      .min(1, { error: CONDUCT_MESSAGES.VOID_REASON_REQUIRED })
      .max(500, { error: CONDUCT_MESSAGES.VOID_REASON_MAX }),
  })
  .strict();

export const conductQuerySchema = z
  .object({
    student_id: z.uuid({ error: CONDUCT_MESSAGES.INVALID_STUDENT_ID }),
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
  })
  .strict();

/** Bounds for the quick-entry recent-records list. */
export const RECENT_CONDUCT_LIMITS = {
  DEFAULT: 10,
  MAX: 25,
} as const;

export const searchConductStudentsSchema = z
  .object({
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
    query: z
      .string({ error: CONDUCT_MESSAGES.SEARCH_REQUIRED })
      .trim()
      .min(1, { error: CONDUCT_MESSAGES.SEARCH_REQUIRED })
      // Same search bound and copy as the roster/attendance pickers.
      .max(100, { error: ROSTER_MESSAGES.SEARCH_MAX_LENGTH }),
  })
  .strict();

export const listRecentBranchConductRecordsSchema = z
  .object({
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
    limit: z
      .number({ error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .int({ error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .min(1, { error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .max(RECENT_CONDUCT_LIMITS.MAX, {
        error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID,
      })
      .default(RECENT_CONDUCT_LIMITS.DEFAULT),
  })
  .strict();

/**
 * Branch records with an optional single-student filter (the Conducta page
 * list). Same bounds as the recent-records list.
 */
export const listBranchConductRecordsSchema = z
  .object({
    branch_id: z.uuid({ error: CONDUCT_MESSAGES.BRANCH_REQUIRED }),
    student_id: z
      .uuid({ error: CONDUCT_MESSAGES.INVALID_STUDENT_ID })
      .optional(),
    limit: z
      .number({ error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .int({ error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .min(1, { error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID })
      .max(RECENT_CONDUCT_LIMITS.MAX, {
        error: CONDUCT_MESSAGES.RECENT_LIMIT_INVALID,
      })
      .default(RECENT_CONDUCT_LIMITS.DEFAULT),
  })
  .strict();

export type CreateConductRecordInput = z.infer<typeof createConductRecordSchema>;
export type ConductRecordActionInput = z.infer<typeof conductRecordActionSchema>;
export type VoidConductRecordInput = z.infer<typeof voidConductRecordSchema>;
export type ConductQueryInput = z.infer<typeof conductQuerySchema>;
export type SearchConductStudentsInput = z.infer<
  typeof searchConductStudentsSchema
>;
export type ListRecentBranchConductRecordsInput = z.input<
  typeof listRecentBranchConductRecordsSchema
>;
export type ListBranchConductRecordsInput = z.input<
  typeof listBranchConductRecordsSchema
>;
