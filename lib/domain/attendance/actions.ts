"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import { ATTENDANCE_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec";
import {
  takeAttendanceSchema,
  attendanceForSessionSchema,
  attendanceStatsSchema,
  CORRECTION_WINDOW_DAYS,
  CAPTURE_WINDOW_DAYS,
  type TakeAttendanceInput,
  type AttendanceForSessionInput,
  type AttendanceStatsInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EligibleStudentAttendance {
  student_id: string;
  first_name: string;
  surname: string;
  attended: boolean | null;
  observation: string | null;
}

/**
 * Convert JS Date.getDay() (0=Sun) to ISO day_of_week (0=Mon..6=Sun).
 * Matches the convention used in lib/domain/classes/actions.ts.
 */
function jsToIsoDayOfWeek(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * takeAttendance — Bulk upsert attendance records for a session.
 *
 * Algorithm (design steps 1-11):
 * 1. Zod validate
 * 2. Auth context
 * 3. Class lookup + RLS scope
 * 4. Weekday integrity + future date guard
 * 5. Suspension check
 * 6. Resolve eligible students (A7 rule)
 * 7. Validate all record student_ids ∈ eligible
 * 8. Load existing attendance → correction map
 * 9. Time window enforcement (D2/D3)
 * 10. Upsert loop
 * 11. Return count
 */
export async function takeAttendance(
  input: TakeAttendanceInput
): Promise<ActionResult<{ count: number }>> {
  // Step 1
  const parsed = takeAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { scheduled_class_id, session_date, records } = parsed.data;
  const sessionDate = new Date(session_date + "T00:00:00");

  // Step 2
  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Step 3: Class lookup
    const cls = await tx.scheduled_classes.findUnique({
      where: { id: scheduled_class_id },
      select: {
        id: true,
        branch_id: true,
        discipline_id: true,
        day_of_week: true,
        is_active: true,
      },
    });

    if (cls === null) {
      return { count: -1, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
    }

    // Step 4: Weekday integrity
    const expectedDay = jsToIsoDayOfWeek(sessionDate.getDay());
    if (expectedDay !== cls.day_of_week) {
      return { count: -1, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
    }

    // Future date guard
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sessionDate > today) {
      return { count: -1, error: ATTENDANCE_MESSAGES.FUTURE_SESSION };
    }

    // Step 5: Suspension check
    const sessionOverride = await tx.class_sessions.findUnique({
      where: {
        scheduled_class_id_session_date: {
          scheduled_class_id,
          session_date: sessionDate,
        },
      },
      select: { status: true },
    });

    if (sessionOverride?.status === "suspended") {
      return { count: -1, error: ATTENDANCE_MESSAGES.SESSION_SUSPENDED };
    }

    // Step 6: Resolve eligible students (A7 rule)
    // enrolled_at <= session_date AND (is_active OR suspended_at >= session_date)
    const eligibleEnrollments = await tx.student_disciplines.findMany({
      where: {
        discipline_id: cls.discipline_id,
        students: { branch_id: cls.branch_id },
        enrolled_at: { lte: sessionDate },
        OR: [
          { is_active: true },
          { suspended_at: { gte: sessionDate } },
        ],
      },
      select: {
        student_id: true,
      },
    });

    const eligibleIds = new Set(eligibleEnrollments.map((e) => e.student_id));

    // Step 7: Validate all records reference eligible students
    for (const record of records) {
      if (!eligibleIds.has(record.student_id)) {
        return { count: -1, error: ATTENDANCE_MESSAGES.INELIGIBLE_STUDENT };
      }
    }

    // Step 8: Load existing attendance
    const recordIds = records.map((r) => r.student_id);
    const existingRecords = await tx.attendance.findMany({
      where: {
        scheduled_class_id,
        session_date: sessionDate,
        student_id: { in: recordIds },
      },
      select: { student_id: true },
    });

    const existingIds = new Set(existingRecords.map((r) => r.student_id));

    // Step 9: Time window enforcement
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (todayMidnight.getTime() - sessionDate.getTime()) / 86400000
    );

    for (const record of records) {
      const isCorrection = existingIds.has(record.student_id);
      if (isCorrection && diffDays > CORRECTION_WINDOW_DAYS) {
        return {
          count: -1,
          error: ATTENDANCE_MESSAGES.CORRECTION_WINDOW_EXCEEDED,
        };
      }
      if (!isCorrection && diffDays > CAPTURE_WINDOW_DAYS) {
        return {
          count: -1,
          error: ATTENDANCE_MESSAGES.CAPTURE_WINDOW_EXCEEDED,
        };
      }
    }

    // Step 10: Upsert loop
    for (const record of records) {
      await tx.attendance.upsert({
        where: {
          scheduled_class_id_session_date_student_id: {
            scheduled_class_id,
            session_date: sessionDate,
            student_id: record.student_id,
          },
        },
        create: {
          scheduled_class_id,
          session_date: sessionDate,
          student_id: record.student_id,
          attended: record.attended,
          observation: record.observation ?? null,
          marked_by: ctx.userId,
        },
        update: {
          attended: record.attended,
          observation: record.observation ?? null,
          marked_by: ctx.userId,
        },
      });
    }

    // Step 11
    return { count: records.length, error: null };
  });

  if (!result.success) return result;
  if (result.data.error) {
    return { success: false, error: result.data.error };
  }

  return { success: true, data: { count: result.data.count } };
}

/**
 * getAttendanceForSession — Returns eligible students with their attendance
 * status for a given session.
 */
export async function getAttendanceForSession(
  input: AttendanceForSessionInput
): Promise<ActionResult<EligibleStudentAttendance[]>> {
  const parsed = attendanceForSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { scheduled_class_id, session_date } = parsed.data;
  const sessionDate = new Date(session_date + "T00:00:00");

  const result = await withAuthenticatedUser(async (tx) => {
    // Class lookup
    const cls = await tx.scheduled_classes.findUnique({
      where: { id: scheduled_class_id },
      select: {
        id: true,
        branch_id: true,
        discipline_id: true,
        day_of_week: true,
      },
    });

    if (cls === null) {
      return null;
    }

    // Weekday integrity
    const expectedDay = jsToIsoDayOfWeek(sessionDate.getDay());
    if (expectedDay !== cls.day_of_week) {
      return null;
    }

    // Resolve eligible students (A7)
    const eligibleEnrollments = await tx.student_disciplines.findMany({
      where: {
        discipline_id: cls.discipline_id,
        students: { branch_id: cls.branch_id },
        enrolled_at: { lte: sessionDate },
        OR: [
          { is_active: true },
          { suspended_at: { gte: sessionDate } },
        ],
      },
      select: {
        student_id: true,
        students: {
          select: { first_name: true, surname: true },
        },
      },
    });

    // Load existing attendance
    const studentIds = eligibleEnrollments.map((e) => e.student_id);
    const existingAttendance = await tx.attendance.findMany({
      where: {
        scheduled_class_id,
        session_date: sessionDate,
        student_id: { in: studentIds },
      },
      select: {
        student_id: true,
        attended: true,
        observation: true,
      },
    });

    const attendanceMap = new Map(
      existingAttendance.map((a) => [a.student_id, a])
    );

    // Build result: eligible students + their attendance status
    const result: EligibleStudentAttendance[] = eligibleEnrollments.map((e) => {
      const existing = attendanceMap.get(e.student_id);
      return {
        student_id: e.student_id,
        first_name: e.students.first_name,
        surname: e.students.surname,
        attended: existing?.attended ?? null,
        observation: existing?.observation ?? null,
      };
    });

    return result;
  });

  if (!result.success) return result;
  if (result.data === null) {
    return { success: false, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
  }

  return { success: true, data: result.data };
}

/**
 * getAttendanceStats — Returns attendance statistics for a student,
 * optionally filtered by discipline and date range.
 */
export async function getAttendanceStats(
  input: AttendanceStatsInput
): Promise<ActionResult<{ present: number; total: number; percentage: number }>> {
  const parsed = attendanceStatsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, discipline_id, from, to } = parsed.data;

  const result = await withAuthenticatedUser(async (tx) => {
    // Build where clause
    const where: Record<string, unknown> = {
      student_id,
    };

    // Date range filter
    if (from || to) {
      const sessionDateFilter: Record<string, Date> = {};
      if (from) sessionDateFilter.gte = new Date(from + "T00:00:00");
      if (to) sessionDateFilter.lte = new Date(to + "T00:00:00");
      where.session_date = sessionDateFilter;
    }

    // Discipline filter via scheduled_classes relation
    if (discipline_id) {
      where.scheduled_classes = { discipline_id };
    }

    const total = await tx.attendance.count({ where });
    const present = await tx.attendance.count({
      where: { ...where, attended: true },
    });
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, total, percentage };
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}
