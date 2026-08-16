import { z } from "zod";
import { ATTENDANCE_MESSAGES } from "@/lib/localization/es-ec";

/**
 * Attendance validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a YYYY-MM-DD string represents a real calendar date.
 * Rejects Feb 30, Apr 31, etc.
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
 * Both attendance entry points accept EITHER a recurring scheduled_class_id
 * (with its own session_date) OR a one_time_class_id (whose date is fixed
 * at creation — no separate session_date needed). Exactly one must be
 * provided, mirroring the DB's XOR CHECK constraint.
 */
export const takeAttendanceSchema = z
  .object({
    scheduled_class_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID }).optional(),
    one_time_class_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID }).optional(),
    session_date: z
      .string()
      .regex(DATE_PATTERN, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .refine(isValidCalendarDate, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .optional(),
    records: z
      .array(
        z.object({
          student_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_STUDENT_ID }),
          attended: z.boolean(),
          observation: z
            .string()
            .max(500, { error: ATTENDANCE_MESSAGES.OBSERVATION_MAX })
            .nullish(),
        })
      )
      .min(1, { error: ATTENDANCE_MESSAGES.MIN_ONE_RECORD }),
  })
  .refine(
    (d) => Boolean(d.scheduled_class_id) !== Boolean(d.one_time_class_id),
    { error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID, path: ["scheduled_class_id"] }
  )
  .refine((d) => !d.scheduled_class_id || Boolean(d.session_date), {
    error: ATTENDANCE_MESSAGES.INVALID_DATE,
    path: ["session_date"],
  });

export const attendanceForSessionSchema = z
  .object({
    scheduled_class_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID }).optional(),
    one_time_class_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID }).optional(),
    session_date: z
      .string()
      .regex(DATE_PATTERN, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .refine(isValidCalendarDate, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .optional(),
  })
  .refine(
    (d) => Boolean(d.scheduled_class_id) !== Boolean(d.one_time_class_id),
    { error: ATTENDANCE_MESSAGES.INVALID_CLASS_ID, path: ["scheduled_class_id"] }
  )
  .refine((d) => !d.scheduled_class_id || Boolean(d.session_date), {
    error: ATTENDANCE_MESSAGES.INVALID_DATE,
    path: ["session_date"],
  });

export const attendanceStatsSchema = z
  .object({
    student_id: z.uuid({ error: ATTENDANCE_MESSAGES.INVALID_STUDENT_ID }),
    discipline_id: z.uuid().optional(),
    from: z
      .string()
      .regex(DATE_PATTERN, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .refine(isValidCalendarDate, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .optional(),
    to: z
      .string()
      .regex(DATE_PATTERN, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .refine(isValidCalendarDate, { error: ATTENDANCE_MESSAGES.INVALID_DATE })
      .optional(),
  })
  .strict();

export type TakeAttendanceInput = z.infer<typeof takeAttendanceSchema>;
export type AttendanceForSessionInput = z.infer<typeof attendanceForSessionSchema>;
export type AttendanceStatsInput = z.infer<typeof attendanceStatsSchema>;

/** D2: Correction window — max days after session_date to modify existing attendance */
export const CORRECTION_WINDOW_DAYS = 7;

/**
 * D3: Retroactive capture window — max days after session_date to mark attendance
 * that was NEVER taken.
 * ⚠️ PROVISIONAL/EXPERIMENTAL — TODO: reduce to 1 day (daily) once workflow is validated.
 */
export const CAPTURE_WINDOW_DAYS = 30;
