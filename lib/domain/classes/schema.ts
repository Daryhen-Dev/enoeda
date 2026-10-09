import {
  CLASS_MESSAGES,
  SUSPENSION_MESSAGES,
} from "@/lib/localization/es-ec";
import { z } from "zod";

export const suspensionCategoryEnum = z.enum([
  "feriado",
  "evento",
  "emergencia",
  "otro",
]);

export type SuspensionCategory = z.infer<typeof suspensionCategoryEnum>;

/** "YYYY-MM" period selector shared by monthly-group inputs and filters. */
export const periodMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, CLASS_MESSAGES.INVALID_PERIOD_MONTH);

export const createMonthlyClassGroupSchema = z.object({
  branch_id: z.uuid(),
  discipline_id: z.uuid(),
  default_teacher_id: z.uuid().nullable().optional(),
  series_name: z
    .string()
    .trim()
    .min(1, CLASS_MESSAGES.SERIES_NAME_REQUIRED)
    .max(80, CLASS_MESSAGES.SERIES_NAME_MAX),
  period_month: periodMonthSchema,
  days_of_week: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .refine((days) => new Set(days).size === days.length, {
      message: CLASS_MESSAGES.DUPLICATE_DAYS,
    }),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const createOneTimeClassSchema = z.object({
  branch_id: z.uuid(),
  discipline_id: z.uuid(),
  teacher_id: z.uuid().nullable().optional(),
  class_date: z.string().date(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export type CreateMonthlyClassGroupInput = z.infer<
  typeof createMonthlyClassGroupSchema
>;
export type CreateOneTimeClassInput = z.infer<typeof createOneTimeClassSchema>;
export type ListClassSeriesInput = z.infer<typeof listClassSeriesSchema>;
export type ListUpcomingOneTimeClassesInput = z.infer<
  typeof listUpcomingOneTimeClassesSchema
>;
export type RenameClassSeriesInput = z.infer<typeof renameClassSeriesSchema>;

export const deactivateScheduledClassSchema = z.object({
  id: z.uuid(),
  branch_id: z.uuid(),
});

// Targets the materialized series identity (scheduled_classes.series_id).
// The caller passes EITHER any one row of the series (scheduled_class_id —
// the calendar dialog) OR the series identity itself (series_id — the
// class-schedules section); passing both or neither is rejected.
export const deactivateScheduledClassSeriesSchema = z
  .object({
    branch_id: z.uuid(),
    scheduled_class_id: z.uuid().optional(),
    series_id: z.uuid().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.scheduled_class_id) !== Boolean(data.series_id),
    {
      message: CLASS_MESSAGES.SERIES_TARGET_REQUIRED,
      path: ["series_id"],
    }
  );

export const listClassSeriesSchema = z.object({
  branch_id: z.uuid(),
  period_month: periodMonthSchema.optional(),
});

export const listUpcomingOneTimeClassesSchema = z.object({
  branch_id: z.uuid(),
});

export const renameClassSeriesSchema = z.object({
  branch_id: z.uuid(),
  series_id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, CLASS_MESSAGES.SERIES_NAME_REQUIRED)
    .max(80, CLASS_MESSAGES.SERIES_NAME_MAX),
});

export const deactivateAllFutureClassesSchema = z.object({
  branch_id: z.uuid(),
});

export const cloneClassGroupSchema = z.object({
  branch_id: z.uuid(),
  series_id: z.uuid(),
});

export type CloneClassGroupInput = z.infer<typeof cloneClassGroupSchema>;

export const getSessionsForRangeSchema = z.object({
  branch_id: z.uuid(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  discipline_ids: z.array(z.uuid()).optional(),
  allow_global_admin_read: z.boolean().optional(),
});

export const suspendSessionSchema = z
  .object({
    scheduled_class_id: z.uuid(),
    session_date: z.string().date(),
    suspension_category: suspensionCategoryEnum,
    suspension_reason: z.string().min(1).optional(),
    branch_id: z.uuid(),
  })
  .refine(
    (data) => data.suspension_category !== "otro" || !!data.suspension_reason,
    {
      message: SUSPENSION_MESSAGES.REASON_REQUIRED_OTRO,
      path: ["suspension_reason"],
    }
  );

export const reinstateSessionSchema = z.object({
  scheduled_class_id: z.uuid(),
  session_date: z.string().date(),
  branch_id: z.uuid(),
});

export const assignTeacherSchema = z
  .object({
    target_type: z.enum(["recurring", "session"]),
    scheduled_class_id: z.uuid(),
    session_date: z.string().date().optional(),
    teacher_id: z.uuid(),
    branch_id: z.uuid(),
  })
  .refine((data) => data.target_type !== "session" || !!data.session_date, {
    message: CLASS_MESSAGES.SESSION_DATE_REQUIRED,
    path: ["session_date"],
  });

export const getSuspensionReportSchema = z.object({
  branch_id: z.uuid().optional(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  group_by: z.enum(["month", "week", "day"]).default("month"),
});

export type DeactivateScheduledClassInput = z.infer<typeof deactivateScheduledClassSchema>;
export type DeactivateScheduledClassSeriesInput = z.infer<
  typeof deactivateScheduledClassSeriesSchema
>;
export type DeactivateAllFutureClassesInput = z.infer<
  typeof deactivateAllFutureClassesSchema
>;
export type GetSessionsForRangeInput = z.infer<typeof getSessionsForRangeSchema>;
export type SuspendSessionInput = z.infer<typeof suspendSessionSchema>;
export type ReinstateSessionInput = z.infer<typeof reinstateSessionSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type GetSuspensionReportInput = z.infer<typeof getSuspensionReportSchema>;
