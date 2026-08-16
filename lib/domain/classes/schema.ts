import {
  CLASS_MESSAGES,
  SUSPENSION_MESSAGES,
} from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Class scheduling validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

export const suspensionCategoryEnum = z.enum([
  "feriado",
  "evento",
  "emergencia",
  "otro",
]);

export type SuspensionCategory = z.infer<typeof suspensionCategoryEnum>;

export const createScheduledClassSchema = z.object({
  branch_id: z.uuid(),
  discipline_id: z.uuid(),
  default_teacher_id: z.uuid().nullable().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
});

/**
 * Batch variant of createScheduledClassSchema: same class (discipline,
 * teacher, time) repeated across multiple weekdays in one submission, so
 * the admin can build a whole week's schedule without repeating the
 * create action per day.
 */
export const createScheduledClassBatchSchema = z.object({
  branch_id: z.uuid(),
  discipline_id: z.uuid(),
  default_teacher_id: z.uuid().nullable().optional(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const updateScheduledClassSchema = createScheduledClassSchema
  .partial()
  .extend({
    id: z.uuid(),
  });

export type CreateScheduledClassBatchInput = z.infer<
  typeof createScheduledClassBatchSchema
>;

export const deactivateScheduledClassSchema = z.object({
  id: z.uuid(),
});

export const getSessionsForRangeSchema = z.object({
  branch_id: z.uuid(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  discipline_ids: z.array(z.uuid()).optional(),
});

export const suspendSessionSchema = z
  .object({
    scheduled_class_id: z.uuid(),
    session_date: z.string().date(),
    suspension_category: suspensionCategoryEnum,
    suspension_reason: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.suspension_category !== "otro" || !!d.suspension_reason,
    {
      message: SUSPENSION_MESSAGES.REASON_REQUIRED_OTRO,
      path: ["suspension_reason"],
    }
  );

export const reinstateSessionSchema = z.object({
  scheduled_class_id: z.uuid(),
  session_date: z.string().date(),
});

export const assignTeacherSchema = z
  .object({
    target_type: z.enum(["recurring", "session"]),
    scheduled_class_id: z.uuid(),
    session_date: z.string().date().optional(),
    teacher_id: z.uuid(),
    force: z.boolean().default(false),
  })
  .refine(
    (d) => d.target_type !== "session" || !!d.session_date,
    {
      message: CLASS_MESSAGES.SESSION_DATE_REQUIRED,
      path: ["session_date"],
    }
  );

export const getSuspensionReportSchema = z.object({
  branch_id: z.uuid().optional(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  group_by: z.enum(["month", "week", "day"]).default("month"),
});

export type CreateScheduledClassInput = z.infer<typeof createScheduledClassSchema>;
export type UpdateScheduledClassInput = z.infer<typeof updateScheduledClassSchema>;
export type DeactivateScheduledClassInput = z.infer<typeof deactivateScheduledClassSchema>;
export type GetSessionsForRangeInput = z.infer<typeof getSessionsForRangeSchema>;
export type SuspendSessionInput = z.infer<typeof suspendSessionSchema>;
export type ReinstateSessionInput = z.infer<typeof reinstateSessionSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type GetSuspensionReportInput = z.infer<typeof getSuspensionReportSchema>;
