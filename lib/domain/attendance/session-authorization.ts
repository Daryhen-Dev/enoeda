/**
 * Shared session authorization for attendance-adjacent actions (attendance,
 * per-class students, guests): resolves the branch/discipline/date of a
 * class occurrence and decides whether the caller may act on it
 * (branch admin, or the session's effective teacher for recurring classes /
 * the assigned teacher of one-time classes).
 *
 * Extracted from lib/domain/attendance/actions.ts so guest actions reuse the
 * exact same guards without exposing an extra "use server" export.
 */

import type { AuthenticatedContext } from "@/lib/auth/server-context";
import type { TransactionClient } from "@/lib/prisma/client";
import { dateOnlyToUtcDate, formatDatabaseDateOnly } from "@/lib/date";

/**
 * Convert JS Date.getDay() (0=Sun) to ISO day_of_week (0=Mon..6=Sun).
 * Matches the convention used in lib/domain/classes/actions.ts.
 */
export function jsToIsoDayOfWeek(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export const ATTENDANCE_SESSION_AUTHORIZATION = {
  AUTHORIZED: "authorized",
  DENIED: "denied",
  INVALID: "invalid",
} as const;

export interface AuthorizedAttendanceSession {
  status: typeof ATTENDANCE_SESSION_AUTHORIZATION.AUTHORIZED;
  branchId: string;
  disciplineId: string;
  /**
   * The session's calendar day as the UTC-midnight instant Postgres `date`
   * columns store (see lib/date.ts), for BOTH class kinds. Callers write and
   * filter `session_date` / `class_date` with it as is; never convert it back
   * to a local midnight.
   */
  sessionDate: Date;
  /** Recurring classes only: the owning monthly group (roster source). */
  seriesId: string | null;
}

interface DeniedAttendanceSession {
  status: typeof ATTENDANCE_SESSION_AUTHORIZATION.DENIED;
}

interface InvalidAttendanceSession {
  status: typeof ATTENDANCE_SESSION_AUTHORIZATION.INVALID;
}

export type AttendanceSessionAuthorization =
  | AuthorizedAttendanceSession
  | DeniedAttendanceSession
  | InvalidAttendanceSession;

export interface AttendanceSessionInput {
  scheduled_class_id?: string;
  one_time_class_id?: string;
  session_date?: string;
}

export async function authorizeAttendanceSession(
  tx: TransactionClient,
  ctx: AuthenticatedContext,
  input: AttendanceSessionInput,
  branchId: string
): Promise<AttendanceSessionAuthorization> {
  const isActiveBranchAdmin = ctx.assignments.some(
    (assignment) =>
      assignment.role === "admin" && assignment.branchId === branchId
  );

  if (input.scheduled_class_id) {
    // `session_date` goes to a Postgres `date` column: UTC midnight of the
    // calendar day, whatever the server timezone.
    const sessionDate = dateOnlyToUtcDate(input.session_date!);
    const scheduledClass = await tx.scheduled_classes.findUnique({
      where: { id: input.scheduled_class_id },
      select: {
        branch_id: true,
        discipline_id: true,
        day_of_week: true,
        series_id: true,
      },
    });

    if (
      !scheduledClass ||
      scheduledClass.branch_id !== branchId ||
      // The weekday of a calendar day is timezone-independent: getUTCDay()
      // on the UTC-midnight instant is the same weekday a local
      // parseDateOnly(...).getDay() reads (S2: local calendar arithmetic,
      // no local midnight value crossing into Prisma).
      scheduledClass.day_of_week !== jsToIsoDayOfWeek(sessionDate.getUTCDay())
    ) {
      return { status: ATTENDANCE_SESSION_AUTHORIZATION.INVALID };
    }

    if (!isActiveBranchAdmin) {
      const [effectiveTeacher] = await tx.$queryRaw<
        { teacher_id: string | null }[]
      >`SELECT private.resolve_effective_teacher(
          ${input.scheduled_class_id}::uuid,
          ${sessionDate}::date
        ) AS teacher_id`;

      if (effectiveTeacher?.teacher_id !== ctx.userId) {
        return { status: ATTENDANCE_SESSION_AUTHORIZATION.DENIED };
      }
    }

    return {
      status: ATTENDANCE_SESSION_AUTHORIZATION.AUTHORIZED,
      branchId: scheduledClass.branch_id,
      disciplineId: scheduledClass.discipline_id,
      sessionDate,
      seriesId: scheduledClass.series_id,
    };
  }

  const oneTimeClass = await tx.one_time_classes.findUnique({
    where: { id: input.one_time_class_id! },
    select: { branch_id: true, discipline_id: true, class_date: true, teacher_id: true },
  });

  if (!oneTimeClass || oneTimeClass.branch_id !== branchId) {
    return { status: ATTENDANCE_SESSION_AUTHORIZATION.INVALID };
  }

  if (!isActiveBranchAdmin && oneTimeClass.teacher_id !== ctx.userId) {
    return { status: ATTENDANCE_SESSION_AUTHORIZATION.DENIED };
  }

  // For a one-time class the date is fixed: Prisma returns `class_date` (a
  // `date` column) as the UTC-midnight instant of the class day, which is
  // exactly the value to write back. Re-normalised through the date-only
  // helpers so any other time-of-day still lands on its own calendar day.
  // (The previous `setHours(0,0,0,0)` moved it to LOCAL midnight, i.e. to the
  // previous day on every server west of UTC.)
  const sessionDate = dateOnlyToUtcDate(
    formatDatabaseDateOnly(oneTimeClass.class_date)
  );

  return {
    status: ATTENDANCE_SESSION_AUTHORIZATION.AUTHORIZED,
    branchId: oneTimeClass.branch_id,
    disciplineId: oneTimeClass.discipline_id,
    sessionDate,
    seriesId: null,
  };
}
