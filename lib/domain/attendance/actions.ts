"use server";

import {
  withAuthenticatedUser,
} from "@/lib/auth/server-context";
import type { TransactionClient } from "@/lib/prisma/client";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { parseDateOnly } from "@/lib/date";
import { ATTENDANCE_MESSAGES, COMMON_MESSAGES, PAYMENT_MESSAGES } from "@/lib/localization/es-ec";
import { createClassPaymentForOccurrence } from "@/lib/domain/payments/class-payment";
import {
  takeAttendanceSchema,
  attendanceForSessionSchema,
  attendanceStatsSchema,
  addPerClassStudentToSessionSchema,
  listPerClassCandidatesSchema,
  CORRECTION_WINDOW_DAYS,
  CAPTURE_WINDOW_DAYS,
  type TakeAttendanceInput,
  type AttendanceForSessionInput,
  type AttendanceStatsInput,
  type AddPerClassStudentToSessionInput,
  type ListPerClassCandidatesInput,
} from "./schema";
import {
  authorizeAttendanceSession,
  ATTENDANCE_SESSION_AUTHORIZATION,
  jsToIsoDayOfWeek,
} from "./session-authorization";
import type { SessionGuestRow } from "@/lib/domain/guests/actions";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Where a session attendance entry comes from. */
export type AttendanceSource = "roster" | "per_class" | "history";

export interface SessionAttendanceEntry {
  student_id: string;
  /** Enrollment in the session's discipline, when one exists. */
  student_discipline_id: string | null;
  first_name: string;
  surname: string;
  attended: boolean | null;
  observation: string | null;
  source: AttendanceSource;
  billing_mode: "monthly" | "per_class" | null;
  class_payment_registered: boolean;
}

export interface PerClassCandidateRow {
  student_id: string;
  student_discipline_id: string;
  first_name: string;
  surname: string;
  national_id: string;
}

export interface PresentStudent {
  first_name: string;
  surname: string;
}

/**
 * getAttendanceForSession return shape: the student attendance entries plus
 * the session's trial-class guests (T7) in a SEPARATE `guests` array.
 * Guests are not students — they have no attendance record, enrollment or
 * billing mode — so they are kept out of the SessionAttendanceEntry list and
 * the UI renders and converts them independently.
 */
export interface SessionAttendanceResult {
  students: SessionAttendanceEntry[];
  guests: SessionGuestRow[];
}

/**
 * Roster student ids of a session: the assigned roster of the occurrence's
 * group (recurring) or of the one-time class itself.
 */
async function getRosterStudentIds(
  tx: TransactionClient,
  seriesId: string | null,
  oneTimeClassId: string | null
): Promise<string[]> {
  if (seriesId) {
    const rows = await tx.class_series_students.findMany({
      where: { series_id: seriesId },
      select: { student_id: true },
    });
    return rows.map((r) => r.student_id);
  }
  const rows = await tx.one_time_class_students.findMany({
    where: { one_time_class_id: oneTimeClassId! },
    select: { student_id: true },
  });
  return rows.map((r) => r.student_id);
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  billing_mode: string;
  is_active: boolean;
}

/**
 * Enrollments in the session's discipline for the given students (all
 * billing modes: needed to classify per-class vs history rows).
 */
async function getEnrollmentsForStudents(
  tx: TransactionClient,
  disciplineId: string,
  studentIds: string[]
): Promise<Map<string, EnrollmentRow>> {
  if (studentIds.length === 0) return new Map();
  const rows = await tx.student_disciplines.findMany({
    where: { discipline_id: disciplineId, student_id: { in: studentIds } },
    select: { id: true, student_id: true, billing_mode: true, is_active: true },
  });
  return new Map(rows.map((row) => [row.student_id, row]));
}

/** Attendance rows of an occurrence (both class kinds). */
function occurrenceAttendanceWhere(
  scheduledClassId: string | null,
  oneTimeClassId: string | null,
  sessionDate: Date
) {
  return scheduledClassId
    ? { scheduled_class_id: scheduledClassId, session_date: sessionDate }
    : { one_time_class_id: oneTimeClassId! };
}

/** Shared name ordering: surname, then first_name. */
function byStudentName(
  a: { first_name: string; surname: string },
  b: { first_name: string; surname: string }
): number {
  const surname = a.surname.localeCompare(b.surname);
  return surname !== 0 ? surname : a.first_name.localeCompare(b.first_name);
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

  const { scheduled_class_id, one_time_class_id, records, branch_id } = parsed.data;

  // Step 2
  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Branch context validation — fail-closed before any DB read
    const branchError = assertCallerBranchContext(ctx, branch_id);
    if (branchError) {
      return { count: -1, error: branchError };
    }

    const attendanceSession = await authorizeAttendanceSession(
      tx,
      ctx,
      parsed.data,
      branch_id
    );
    if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.INVALID) {
      return { count: -1, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
    }
    if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED) {
      return { count: -1, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }

    const { disciplineId, sessionDate } = attendanceSession;

    if (scheduled_class_id) {
      // Step 5: Suspension check (only recurring classes can be suspended)
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
    }

    // Future date guard (applies to both kinds)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sessionDate > today) {
      return { count: -1, error: ATTENDANCE_MESSAGES.FUTURE_SESSION };
    }

    // Step 6: Resolve eligible students (T6 rule): the assigned roster of
    // the occurrence's group (or one-time class) PLUS per-class students
    // (billing_mode 'per_class') already added to this occurrence. Monthly
    // students who are not on the roster are rejected.
    const rosterStudentIds = await getRosterStudentIds(
      tx,
      attendanceSession.seriesId,
      one_time_class_id ?? null
    );

    const occurrenceAttendance = await tx.attendance.findMany({
      where: occurrenceAttendanceWhere(
        scheduled_class_id ?? null,
        one_time_class_id ?? null,
        sessionDate
      ),
      select: { student_id: true },
    });

    const enrollments = await getEnrollmentsForStudents(
      tx,
      disciplineId,
      occurrenceAttendance.map((a) => a.student_id)
    );
    const perClassInOccurrence = occurrenceAttendance
      .filter(
        (row) => enrollments.get(row.student_id)?.billing_mode === "per_class"
      )
      .map((row) => row.student_id);

    const eligibleIds = new Set<string>([
      ...rosterStudentIds,
      ...perClassInOccurrence,
    ]);

    // Step 7: Validate all records reference eligible students
    for (const record of records) {
      if (!eligibleIds.has(record.student_id)) {
        return { count: -1, error: ATTENDANCE_MESSAGES.INELIGIBLE_STUDENT };
      }
    }

    // Step 8: Load existing attendance
    const recordIds = records.map((r) => r.student_id);
    const existingRecords = await tx.attendance.findMany({
      where: scheduled_class_id
        ? {
            scheduled_class_id,
            session_date: sessionDate,
            student_id: { in: recordIds },
          }
        : {
            one_time_class_id,
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

    // Step 10: Find-then-write loop. A plain upsert on a compound key is
    // not usable here: uniqueness is enforced via two PARTIAL unique
    // indexes (one per class kind, see migration
    // 20260824000000_attendance_for_one_time_classes.sql), which Prisma
    // cannot express as a `where` compound-unique input.
    for (const record of records) {
      const existing = await tx.attendance.findFirst({
        where: scheduled_class_id
          ? { scheduled_class_id, session_date: sessionDate, student_id: record.student_id }
          : { one_time_class_id, student_id: record.student_id },
        select: { id: true },
      });

      if (existing) {
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            attended: record.attended,
            observation: record.observation ?? null,
            marked_by: ctx.userId,
          },
        });
      } else {
        await tx.attendance.create({
          data: {
            scheduled_class_id: scheduled_class_id ?? null,
            one_time_class_id: one_time_class_id ?? null,
            session_date: sessionDate,
            student_id: record.student_id,
            attended: record.attended,
            observation: record.observation ?? null,
            marked_by: ctx.userId,
          },
        });
      }
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
 * getAttendanceForSession — Returns the session's attendance list (T6) plus
 * its trial-class guests (T7): students composed of the assigned roster
 * (source "roster"), per-class students added to the occurrence (source
 * "per_class") and any other attendance rows kept as history (source
 * "history", e.g. students later removed from the roster), each group
 * ordered by surname, first_name; guests in a SEPARATE `guests` array
 * (see SessionAttendanceResult).
 */
export async function getAttendanceForSession(
  input: AttendanceForSessionInput
): Promise<ActionResult<SessionAttendanceResult>> {
  const parsed = attendanceForSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { scheduled_class_id, one_time_class_id, branch_id } = parsed.data;

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Branch context validation — fail-closed before any DB read
    const branchError = assertCallerBranchContext(ctx, branch_id);
    if (branchError) {
      return null;
    }

    const attendanceSession = await authorizeAttendanceSession(
      tx,
      ctx,
      parsed.data,
      branch_id
    );
    if (attendanceSession.status !== ATTENDANCE_SESSION_AUTHORIZATION.AUTHORIZED) {
      return attendanceSession;
    }

    const { disciplineId, sessionDate, seriesId } = attendanceSession;

    // 1. Assigned roster with names
    const rosterRows = seriesId
      ? await tx.class_series_students.findMany({
          where: { series_id: seriesId },
          select: {
            student_id: true,
            students: { select: { first_name: true, surname: true } },
          },
        })
      : await tx.one_time_class_students.findMany({
          where: { one_time_class_id: one_time_class_id! },
          select: {
            student_id: true,
            students: { select: { first_name: true, surname: true } },
          },
        });

    // 2. Every attendance row of the occurrence (roster + per-class + history)
    const occurrenceAttendance = await tx.attendance.findMany({
      where: occurrenceAttendanceWhere(
        scheduled_class_id ?? null,
        one_time_class_id ?? null,
        sessionDate
      ),
      select: { student_id: true, attended: true, observation: true },
    });

    // 3. Enrollments in the session's discipline for every involved student
    const involvedIds = [
      ...new Set([
        ...rosterRows.map((r) => r.student_id),
        ...occurrenceAttendance.map((a) => a.student_id),
      ]),
    ];
    const enrollments = await getEnrollmentsForStudents(
      tx,
      disciplineId,
      involvedIds
    );

    // 4. Class payments registered for those enrollments in this occurrence
    const enrollmentIds = [...new Set(
      [...enrollments.values()].map((e) => e.id)
    )];
    const paidEnrollmentIds = new Set(
      enrollmentIds.length
        ? (
            await tx.class_payments.findMany({
              where: {
                student_discipline_id: { in: enrollmentIds },
                ...(scheduled_class_id
                  ? { scheduled_class_id, class_date: sessionDate }
                  : { one_time_class_id }),
              },
              select: { student_discipline_id: true },
            })
          ).map((row) => row.student_discipline_id)
        : []
    );

    // Names for non-roster attendance students (per-class / history)
    const nonRosterAttendanceIds = [
      ...new Set(
        occurrenceAttendance
          .map((a) => a.student_id)
          .filter((id) => !rosterRows.some((r) => r.student_id === id))
      ),
    ];
    const nonRosterStudents = nonRosterAttendanceIds.length
      ? await tx.students.findMany({
          where: { id: { in: nonRosterAttendanceIds } },
          select: { id: true, first_name: true, surname: true },
        })
      : [];
    const nameById = new Map(nonRosterStudents.map((s) => [s.id, s]));

    const attendanceByStudent = new Map(
      occurrenceAttendance.map((a) => [a.student_id, a])
    );

    function buildEntry(
      studentId: string,
      name: { first_name: string; surname: string },
      source: AttendanceSource
    ): SessionAttendanceEntry {
      const enrollment = enrollments.get(studentId);
      const existing = attendanceByStudent.get(studentId);
      return {
        student_id: studentId,
        student_discipline_id: enrollment?.id ?? null,
        first_name: name.first_name,
        surname: name.surname,
        attended: existing?.attended ?? null,
        observation: existing?.observation ?? null,
        source,
        billing_mode:
          enrollment?.billing_mode === "per_class" ||
          enrollment?.billing_mode === "monthly"
            ? enrollment.billing_mode
            : null,
        class_payment_registered: enrollment
          ? paidEnrollmentIds.has(enrollment.id)
          : false,
      };
    }

    const rosterEntries = rosterRows
      .map((row) =>
        buildEntry(
          row.student_id,
          row.students,
          "roster" as const
        )
      )
      .sort(byStudentName);

    const perClassEntries: SessionAttendanceEntry[] = [];
    const historyEntries: SessionAttendanceEntry[] = [];
    for (const row of occurrenceAttendance) {
      if (rosterRows.some((r) => r.student_id === row.student_id)) continue;
      const name = nameById.get(row.student_id);
      if (!name) continue;
      const source: AttendanceSource =
        enrollments.get(row.student_id)?.billing_mode === "per_class"
          ? "per_class"
          : "history";
      (source === "per_class" ? perClassEntries : historyEntries).push(
        buildEntry(row.student_id, name, source)
      );
    }
    perClassEntries.sort(byStudentName);
    historyEntries.sort(byStudentName);

    // 5. Trial-class guests of the occurrence (T7), separate from students
    const guestRows = await tx.class_guests.findMany({
      where: occurrenceAttendanceWhere(
        scheduled_class_id ?? null,
        one_time_class_id ?? null,
        sessionDate
      ),
      select: {
        id: true,
        first_name: true,
        surname: true,
        phone: true,
        observation: true,
        converted_student_id: true,
        created_by: true,
      },
      orderBy: [{ surname: "asc" }, { first_name: "asc" }],
    });
    const guests: SessionGuestRow[] = guestRows.map((row) => ({
      guest_id: row.id,
      first_name: row.first_name,
      surname: row.surname,
      phone: row.phone,
      observation: row.observation,
      converted_student_id: row.converted_student_id,
      created_by: row.created_by,
    }));

    return {
      students: [...rosterEntries, ...perClassEntries, ...historyEntries],
      guests,
    };
  });

  if (!result.success) return result;
  if (!result.data || !("students" in result.data)) {
    if (result.data?.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
  }

  return { success: true, data: result.data };
}

/**
 * getPresentStudentsForSession — Returns the names of students marked present
 * after validating the resource branch and session-specific authorization.
 */
export async function getPresentStudentsForSession(
  input: AttendanceForSessionInput
): Promise<ActionResult<PresentStudent[]>> {
  const parsed = attendanceForSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, scheduled_class_id, one_time_class_id } = parsed.data;
  const result = await withAuthenticatedUser(async (tx, ctx) => {
    const isOwner = ctx.roles.includes("owner");
    const isActiveBranchAdmin = ctx.assignments.some(
      (assignment) => assignment.role === "admin" && assignment.branchId === branch_id
    );

    if (!isOwner) {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) return { kind: "denied" } as const;
    }

    if (scheduled_class_id) {
      const sessionDate = parseDateOnly(parsed.data.session_date!);
      const scheduledClass = await tx.scheduled_classes.findUnique({
        where: { id: scheduled_class_id },
        select: { branch_id: true, day_of_week: true },
      });

      if (
        !scheduledClass ||
        scheduledClass.branch_id !== branch_id ||
        scheduledClass.day_of_week !== jsToIsoDayOfWeek(sessionDate.getDay())
      ) {
        return { kind: "invalid" } as const;
      }

      const [effectiveTeacher] = await tx.$queryRaw<
        { teacher_id: string | null }[]
      >`SELECT private.resolve_effective_teacher(
          ${scheduled_class_id}::uuid,
          ${sessionDate}::date
        ) AS teacher_id`;
      const isEffectiveTeacher = effectiveTeacher?.teacher_id === ctx.userId;

      if (!isOwner && !isActiveBranchAdmin && !isEffectiveTeacher) {
        return { kind: "denied" } as const;
      }

      const records = await tx.attendance.findMany({
        where: { scheduled_class_id, session_date: sessionDate, attended: true },
        select: { students: { select: { first_name: true, surname: true } } },
      });
      return { kind: "success", students: records.map((record) => record.students) } as const;
    }

    const oneTimeClass = await tx.one_time_classes.findUnique({
      where: { id: one_time_class_id! },
      select: { branch_id: true, teacher_id: true },
    });

    if (!oneTimeClass || oneTimeClass.branch_id !== branch_id) {
      return { kind: "invalid" } as const;
    }

    if (
      !isOwner &&
      !isActiveBranchAdmin &&
      oneTimeClass.teacher_id !== ctx.userId
    ) {
      return { kind: "denied" } as const;
    }

    const records = await tx.attendance.findMany({
      where: { one_time_class_id, attended: true },
      select: { students: { select: { first_name: true, surname: true } } },
    });
    return { kind: "success", students: records.map((record) => record.students) } as const;
  });

  if (!result.success) return result;
  if (result.data.kind === "denied") {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }
  if (result.data.kind === "invalid") {
    return { success: false, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
  }

  return { success: true, data: result.data.students };
}

const ATTENDANCE_MESSAGES_SET = new Set<string>([
  ...Object.values(ATTENDANCE_MESSAGES),
  ...Object.values(BRANCH_ASSERTION_MESSAGES),
  COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS,
  COMMON_MESSAGES.AUTHENTICATION_REQUIRED,
]);

/**
 * Keep known, expected guard failures as user-facing copy; everything else
 * falls back to the generic unexpected-error message.
 */
function mapAttendanceActionError(error: unknown): string | undefined {
  if (error instanceof Error && ATTENDANCE_MESSAGES_SET.has(error.message)) {
    return error.message;
  }
  if (
    error instanceof Error &&
    (error.message === PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET ||
      error.message === PAYMENT_MESSAGES.ALREADY_PAID ||
      error.message === PAYMENT_MESSAGES.ENROLLMENT_NOT_FOUND)
  ) {
    return error.message;
  }
  return undefined;
}

/**
 * listPerClassCandidates — Active per-class students of the session's
 * discipline in the branch who are NOT already in the occurrence. Same
 * session authorization as attendance (teacher of the session or branch
 * admin). Optional case-insensitive search on names/national_id, limit 50,
 * ordered by surname, first_name. Also returns the discipline's class price
 * so the UI can offer the inline payment with its amount.
 */
export async function listPerClassCandidates(
  input: ListPerClassCandidatesInput
): Promise<ActionResult<{
  students: PerClassCandidateRow[];
  class_price: number | null;
}>> {
  const parsed = listPerClassCandidatesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { scheduled_class_id, one_time_class_id, branch_id, search } =
    parsed.data;

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    const branchError = assertCallerBranchContext(ctx, branch_id);
    if (branchError) {
      return branchError;
    }

    const attendanceSession = await authorizeAttendanceSession(
      tx,
      ctx,
      parsed.data,
      branch_id
    );
    if (attendanceSession.status !== ATTENDANCE_SESSION_AUTHORIZATION.AUTHORIZED) {
      return attendanceSession;
    }

    const { branchId, disciplineId, sessionDate } = attendanceSession;

    // Students already in the occurrence are excluded.
    const occurrenceAttendance = await tx.attendance.findMany({
      where: occurrenceAttendanceWhere(
        scheduled_class_id ?? null,
        one_time_class_id ?? null,
        sessionDate
      ),
      select: { student_id: true },
    });
    const presentIds = new Set(occurrenceAttendance.map((a) => a.student_id));

    // Active per-class enrollments in the session's discipline.
    const enrollments = await tx.student_disciplines.findMany({
      where: {
        discipline_id: disciplineId,
        is_active: true,
        billing_mode: "per_class",
      },
      select: { id: true, student_id: true },
    });
    const candidateIds = enrollments
      .map((row) => row.student_id)
      .filter((studentId) => !presentIds.has(studentId));
    const enrollmentIdByStudent = new Map(
      enrollments.map((row) => [row.student_id, row.id])
    );

    if (candidateIds.length === 0) {
      const discipline = await tx.disciplines.findUnique({
        where: { id: disciplineId },
        select: { class_price: true },
      });
      return {
        students: [],
        class_price:
          discipline?.class_price != null
            ? Number(discipline.class_price)
            : null,
      };
    }

    const students = await tx.students.findMany({
      where: {
        id: { in: candidateIds },
        branch_id: branchId,
        is_active: true,
        ...(search
          ? {
              OR: [
                { first_name: { contains: search, mode: "insensitive" } },
                { surname: { contains: search, mode: "insensitive" } },
                { national_id: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { id: true, first_name: true, surname: true, national_id: true },
      orderBy: [{ surname: "asc" }, { first_name: "asc" }],
      take: 50,
    });

    const discipline = await tx.disciplines.findUnique({
      where: { id: disciplineId },
      select: { class_price: true },
    });

    return {
      students: students.map((student) => ({
        student_id: student.id,
        student_discipline_id: enrollmentIdByStudent.get(student.id)!,
        first_name: student.first_name,
        surname: student.surname,
        national_id: student.national_id,
      })),
      class_price:
        discipline?.class_price != null
          ? Number(discipline.class_price)
          : null,
    };
  });

  if (!result.success) return result;
  if (typeof result.data === "string") {
    return { success: false, error: result.data };
  }
  if (
    result.data &&
    "status" in result.data &&
    result.data.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED
  ) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }
  if (!result.data || !("students" in result.data)) {
    return { success: false, error: ATTENDANCE_MESSAGES.INVALID_SESSION };
  }

  return { success: true, data: result.data };
}

/**
 * addPerClassStudentToSession — Adds a per-class student to a session in ONE
 * transaction: authorizes the session (same guards as takeAttendance:
 * branch, session authorization, suspension, future date, capture window),
 * validates the student is an active per-class student of the discipline,
 * creates their attendance (attended = true) and — unless the caller
 * explicitly opts out with register_payment: false — registers the class
 * payment priced from the discipline's class_price. Fails without any
 * partial write when the discipline has no class price configured.
 */
export async function addPerClassStudentToSession(
  input: AddPerClassStudentToSessionInput
): Promise<ActionResult<{
  attendance_id: string;
  class_payment_id: string | null;
  amount: number | null;
}>> {
  const parsed = addPerClassStudentToSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { scheduled_class_id, one_time_class_id, branch_id, student_id } =
    parsed.data;
  const registerPayment = parsed.data.register_payment !== false;

  try {
    const result = await withAuthenticatedUser(
      async (tx, ctx) => {
        const branchError = assertCallerBranchContext(ctx, branch_id);
        if (branchError) {
          throw new Error(branchError);
        }

        const attendanceSession = await authorizeAttendanceSession(
          tx,
          ctx,
          parsed.data,
          branch_id
        );
        if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.INVALID) {
          throw new Error(ATTENDANCE_MESSAGES.INVALID_SESSION);
        }
        if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED) {
          throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
        }

        const { disciplineId, sessionDate } = attendanceSession;

        if (scheduled_class_id) {
          // Suspension check (only recurring classes can be suspended)
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
            throw new Error(ATTENDANCE_MESSAGES.SESSION_SUSPENDED);
          }
        }

        // Future date guard
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (sessionDate > today) {
          throw new Error(ATTENDANCE_MESSAGES.FUTURE_SESSION);
        }

        // Capture window guard (this creates a NEW attendance record)
        const diffDays = Math.floor(
          (today.getTime() - sessionDate.getTime()) / 86400000
        );
        if (diffDays > CAPTURE_WINDOW_DAYS) {
          throw new Error(ATTENDANCE_MESSAGES.CAPTURE_WINDOW_EXCEEDED);
        }

        // Eligible per-class student: active student of the branch with an
        // active per_class enrollment in the session's discipline.
        const student = await tx.students.findUnique({
          where: { id: student_id },
          select: { id: true, branch_id: true, is_active: true },
        });
        if (!student || student.branch_id !== branch_id || !student.is_active) {
          throw new Error(ATTENDANCE_MESSAGES.STUDENT_NOT_PER_CLASS);
        }

        const enrollment = await tx.student_disciplines.findFirst({
          where: {
            student_id,
            discipline_id: disciplineId,
            is_active: true,
            billing_mode: "per_class",
          },
          select: {
            id: true,
            disciplines: { select: { class_price: true } },
          },
        });
        if (!enrollment) {
          throw new Error(ATTENDANCE_MESSAGES.STUDENT_NOT_PER_CLASS);
        }

        // Fail BEFORE any write when the inline payment cannot be priced.
        if (
          registerPayment &&
          (enrollment.disciplines.class_price === null ||
            enrollment.disciplines.class_price === undefined)
        ) {
          throw new Error(PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET);
        }

        // Already added to this occurrence?
        const existingAttendance = await tx.attendance.findFirst({
          where: {
            ...occurrenceAttendanceWhere(
              scheduled_class_id ?? null,
              one_time_class_id ?? null,
              sessionDate
            ),
            student_id,
          },
          select: { id: true },
        });
        if (existingAttendance) {
          throw new Error(ATTENDANCE_MESSAGES.STUDENT_ALREADY_ADDED);
        }

        const attendance = await tx.attendance.create({
          data: {
            scheduled_class_id: scheduled_class_id ?? null,
            one_time_class_id: one_time_class_id ?? null,
            session_date: sessionDate,
            student_id,
            attended: true,
            observation: parsed.data.observation ?? null,
            marked_by: ctx.userId,
          },
          select: { id: true },
        });

        if (!registerPayment) {
          return {
            attendance_id: attendance.id,
            class_payment_id: null,
            amount: null,
          };
        }

        const payment = await createClassPaymentForOccurrence({
          tx,
          student_discipline_id: enrollment.id,
          branch_id,
          recorded_by: ctx.userId,
          class_date: sessionDate,
          scheduled_class_id: scheduled_class_id ?? null,
          one_time_class_id: one_time_class_id ?? null,
        });
        if (!payment.ok) {
          // Throw inside the transaction: the attendance write rolls back.
          throw new Error(payment.error);
        }

        return {
          attendance_id: attendance.id,
          class_payment_id: payment.id,
          amount: payment.amount,
        };
      },
      { mapTransactionError: mapAttendanceActionError }
    );

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * getAttendanceStats — Returns attendance statistics for a student,
 * optionally filtered by discipline and date range.
 * Requires branch context — validates caller assignment and student belongs to branch.
 */
export async function getAttendanceStats(
  input: AttendanceStatsInput
): Promise<ActionResult<{ present: number; total: number; percentage: number }>> {
  const parsed = attendanceStatsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, branch_id, discipline_id, from, to } = parsed.data;

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Branch context validation — fail-closed before any DB read
    const branchError = assertCallerBranchContext(ctx, branch_id);
    if (branchError) {
      return { present: 0, total: 0, percentage: 0, __branchError: branchError } as const;
    }

    // Validate student belongs to the caller's branch
    const student = await tx.students.findUnique({
      where: { id: student_id },
      select: { branch_id: true },
    });
    if (!student || student.branch_id !== branch_id) {
      return { present: 0, total: 0, percentage: 0, __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED } as const;
    }

    // Build where clause. Deliberately excludes one_time_classes
    // (recovery/makeup class) attendance from the student's regular
    // attendance statistics. Promotion eligibility evaluates its own
    // branch-scoped recurring and one-time class records.
    const where: Record<string, unknown> = {
      student_id,
      scheduled_class_id: { not: null },
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
  if ("__branchError" in result.data) {
    return { success: false, error: result.data.__branchError };
  }
  return { success: true, data: result.data };
}
