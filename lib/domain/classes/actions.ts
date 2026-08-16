"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import type { TransactionClient } from "@/lib/prisma/client";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  SUSPENSION_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
  WEEKDAY_LABELS,
} from "@/lib/localization/es-ec";
import {
  assignTeacherSchema,
  createOneTimeClassSchema,
  createScheduledClassBatchSchema,
  createScheduledClassSchema,
  deactivateScheduledClassSchema,
  getSessionsForRangeSchema,
  getSuspensionReportSchema,
  reinstateSessionSchema,
  suspendSessionSchema,
  updateScheduledClassSchema,
} from "./schema";
import { ONE_TIME_CLASS_MESSAGES } from "@/lib/localization/es-ec";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- View types ---

export interface SessionView {
  scheduled_class_id: string;
  session_date: string;
  discipline_id: string;
  discipline_name: string;
  discipline_code: string;
  start_time: string;
  end_time: string;
  teacher_id: string | null;
  status: "scheduled" | "suspended";
  suspension_category: string | null;
  suspension_reason: string | null;
  is_substitute: boolean;
  /** true when this session comes from one_time_classes, not a recurring template. */
  is_one_time: boolean;
}

export interface ConflictingAssignment {
  type: "recurring" | "session";
  class_id: string;
  class_name: string;
  branch_name: string;
  day_of_week: number;
  start_time: string;
  session_date?: string;
}

export interface AssignTeacherResult {
  success: boolean;
  conflict?: boolean;
  conflicting_assignments?: ConflictingAssignment[];
  requires_confirmation?: boolean;
  message?: string;
  teacher_assigned?: boolean;
  affected_classes?: Array<{
    class_id: string;
    class_name: string;
    branch_name: string;
    previous_teacher_removed: boolean;
  }>;
}

export interface SuspensionReportRow {
  period: string;
  total_suspended: number;
  by_category: {
    feriado: number;
    evento: number;
    emergencia: number;
    otro: number;
  };
  sessions: Array<{
    date: string;
    class_name: string;
    category: string;
    reason: string | null;
  }>;
}

// --- Helpers ---

/**
 * Convert JS Date.getDay() (0=Sun) to ISO day_of_week (0=Mon..6=Sun).
 */
function jsToIsoDayOfWeek(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * Format a Date to "HH:MM" string.
 */
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Add one hour to a time string "HH:MM" → "HH:MM".
 */
function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// --- Internal: Teacher conflict detection (GLOBAL, cross-branch) ---

async function detectTeacherConflicts(
  tx: TransactionClient,
  teacherId: string,
  isoDay: number,
  startTime: string,
  excludeClassId?: string
): Promise<ConflictingAssignment[]> {
  const conflicts: ConflictingAssignment[] = [];

  // Parse the target time range
  const [targetH, targetM] = startTime.split(":").map(Number);
  const targetStart = targetH * 60 + targetM;
  const targetEnd = targetStart + 60; // 1 hour

  // Check recurring scheduled_classes
  const recurringConflicts = await tx.scheduled_classes.findMany({
    where: {
      default_teacher_id: teacherId,
      day_of_week: isoDay,
      is_active: true,
      ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
    },
    include: {
      branches: { select: { name: true } },
      disciplines: { select: { name: true } },
    },
  });

  for (const cls of recurringConflicts) {
    const clsTime = formatTime(cls.start_time);
    const [clsH, clsM] = clsTime.split(":").map(Number);
    const clsStart = clsH * 60 + clsM;
    const clsEnd = clsStart + 60;

    // Check overlap: starts before other ends AND ends after other starts
    if (targetStart < clsEnd && targetEnd > clsStart) {
      conflicts.push({
        type: "recurring",
        class_id: cls.id,
        class_name: cls.disciplines.name,
        branch_name: cls.branches.name,
        day_of_week: cls.day_of_week,
        start_time: clsTime,
      });
    }
  }

  // Check session-level overrides
  const sessionConflicts = await tx.class_sessions.findMany({
    where: {
      assigned_teacher_id: teacherId,
      status: "scheduled",
      scheduled_classes: {
        day_of_week: isoDay,
        is_active: true,
        ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
      },
    },
    include: {
      scheduled_classes: {
        include: {
          branches: { select: { name: true } },
          disciplines: { select: { name: true } },
        },
      },
    },
  });

  for (const session of sessionConflicts) {
    const parentTime = formatTime(session.scheduled_classes.start_time);
    const [pH, pM] = parentTime.split(":").map(Number);
    const pStart = pH * 60 + pM;
    const pEnd = pStart + 60;

    if (targetStart < pEnd && targetEnd > pStart) {
      conflicts.push({
        type: "session",
        class_id: session.scheduled_classes.id,
        class_name: session.scheduled_classes.disciplines.name,
        branch_name: session.scheduled_classes.branches.name,
        day_of_week: session.scheduled_classes.day_of_week,
        start_time: parentTime,
        session_date: session.session_date.toISOString().split("T")[0],
      });
    }
  }

  return conflicts;
}

// --- Server Actions ---

/**
 * Create a new recurring weekly class.
 * Owner/Admin-branch via RLS.
 */
export async function createScheduledClass(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = createScheduledClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.scheduled_classes.create({
        data: {
          branch_id: parsed.data.branch_id,
          discipline_id: parsed.data.discipline_id,
          default_teacher_id: parsed.data.default_teacher_id ?? null,
          day_of_week: parsed.data.day_of_week,
          start_time: new Date(`1970-01-01T${parsed.data.start_time}:00`),
        },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("scheduled_classes_no_overlap")) {
        return { success: false, error: CLASS_MESSAGES.OVERLAP };
      }
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

export interface CreateScheduledClassBatchResult {
  created: Array<{ day_of_week: number; id: string }>;
  failed: Array<{ day_of_week: number; error: string }>;
}

/**
 * Create the same recurring class (discipline, teacher, time) across
 * several weekdays in one submission. Lets the admin build a whole
 * week's schedule at once instead of repeating createScheduledClass per
 * day. Each day is attempted independently — a scheduling conflict
 * (overlap) on one day does NOT roll back the others; the caller sees
 * exactly which days succeeded and which failed, keeping full control
 * over the outcome. Owner/Admin-branch via RLS.
 */
export async function createScheduledClassBatch(
  input: unknown
): Promise<ActionResult<CreateScheduledClassBatchResult>> {
  const parsed = createScheduledClassBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, discipline_id, default_teacher_id, days_of_week, start_time } =
    parsed.data;

  const created: CreateScheduledClassBatchResult["created"] = [];
  const failed: CreateScheduledClassBatchResult["failed"] = [];

  for (const day_of_week of days_of_week) {
    try {
      const result = await withAuthenticatedUser(async (tx) => {
        return tx.scheduled_classes.create({
          data: {
            branch_id,
            discipline_id,
            default_teacher_id: default_teacher_id ?? null,
            day_of_week,
            start_time: new Date(`1970-01-01T${start_time}:00`),
          },
          select: { id: true },
        });
      });

      if (!result.success) {
        failed.push({ day_of_week, error: result.error });
        continue;
      }
      created.push({ day_of_week, id: result.data.id });
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("scheduled_classes_no_overlap")
          ? CLASS_MESSAGES.OVERLAP_ON_DAY(WEEKDAY_LABELS[day_of_week])
          : COMMON_MESSAGES.UNEXPECTED_ERROR;
      failed.push({ day_of_week, error: message });
    }
  }

  if (created.length === 0) {
    return {
      success: false,
      error: failed[0]?.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  return { success: true, data: { created, failed } };
}

/**
 * Create a single-occurrence class on a specific date, outside the
 * weekly recurring pattern (e.g. an extra class held once this month).
 * Rejects (never writes) when the date/time already has a class:
 * - a recurring scheduled_classes template covering that weekday+time, or
 * - another one_time_classes row on the same branch/date/time
 * (the second case is enforced by the DB EXCLUDE constraint; the first
 * is checked here since one_time_classes has no relationship to
 * scheduled_classes). Owner/Admin-branch via RLS.
 */
export async function createOneTimeClass(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = createOneTimeClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, discipline_id, teacher_id, class_date, start_time } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      // Reject up front if a recurring class already covers this
      // weekday+time slot for the branch — never write in that case.
      const classDate = new Date(class_date);
      const isoDay = jsToIsoDayOfWeek(classDate.getDay());
      const [targetH, targetM] = start_time.split(":").map(Number);
      const targetStart = targetH * 60 + targetM;
      const targetEnd = targetStart + 60;

      const recurringOnSameDay = await tx.scheduled_classes.findMany({
        where: { branch_id, day_of_week: isoDay, is_active: true },
        select: { start_time: true },
      });

      const hasRecurringConflict = recurringOnSameDay.some((cls) => {
        const clsTime = formatTime(cls.start_time);
        const [clsH, clsM] = clsTime.split(":").map(Number);
        const clsStart = clsH * 60 + clsM;
        const clsEnd = clsStart + 60;
        return targetStart < clsEnd && targetEnd > clsStart;
      });

      if (hasRecurringConflict) {
        return { id: null, error: ONE_TIME_CLASS_MESSAGES.OVERLAP };
      }

      const created = await tx.one_time_classes.create({
        data: {
          branch_id,
          discipline_id,
          teacher_id: teacher_id ?? null,
          class_date: classDate,
          start_time: new Date(`1970-01-01T${start_time}:00`),
        },
        select: { id: true },
      });

      return { id: created.id, error: null };
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("one_time_classes_no_overlap")) {
      return { success: false, error: ONE_TIME_CLASS_MESSAGES.OVERLAP };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Update an existing recurring class.
 * Owner/Admin-branch via RLS.
 */
export async function updateScheduledClass(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateScheduledClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...fields } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const data: Record<string, unknown> = {};
      if (fields.branch_id !== undefined) data.branch_id = fields.branch_id;
      if (fields.discipline_id !== undefined) data.discipline_id = fields.discipline_id;
      if (fields.default_teacher_id !== undefined) data.default_teacher_id = fields.default_teacher_id;
      if (fields.day_of_week !== undefined) data.day_of_week = fields.day_of_week;
      if (fields.start_time !== undefined) {
        data.start_time = new Date(`1970-01-01T${fields.start_time}:00`);
      }

      return tx.scheduled_classes.update({
        where: { id },
        data,
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("scheduled_classes_no_overlap")) {
        return { success: false, error: CLASS_MESSAGES.OVERLAP };
      }
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Deactivate a scheduled class (set is_active=false). Never deletes.
 * Owner/Admin-branch via RLS.
 */
export async function deactivateScheduledClass(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = deactivateScheduledClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.scheduled_classes.update({
        where: { id: parsed.data.id },
        data: { is_active: false },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get sessions for a date range (virtual expansion + materialized overlay).
 * Any authenticated user with branch access via RLS.
 */
export async function getSessionsForRange(
  input: unknown
): Promise<ActionResult<SessionView[]>> {
  const parsed = getSessionsForRangeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, start_date, end_date, discipline_ids } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      // 1. Fetch active scheduled classes for the branch
      const classes = await tx.scheduled_classes.findMany({
        where: {
          branch_id,
          is_active: true,
          ...(discipline_ids && discipline_ids.length > 0
            ? { discipline_id: { in: discipline_ids } }
            : {}),
        },
        include: {
          disciplines: { select: { id: true, name: true, code: true } },
        },
      });

      if (classes.length === 0) return [];

      // 2. Expand virtual sessions by iterating dates
      const sessions: SessionView[] = [];
      const start = new Date(start_date);
      const end = new Date(end_date);

      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        const isoDay = jsToIsoDayOfWeek(d.getDay());
        const dateStr = d.toISOString().split("T")[0];

        for (const cls of classes) {
          if (cls.day_of_week === isoDay) {
            const timeStr = formatTime(cls.start_time);
            sessions.push({
              scheduled_class_id: cls.id,
              session_date: dateStr,
              discipline_id: cls.disciplines.id,
              discipline_name: cls.disciplines.name,
              discipline_code: cls.disciplines.code,
              start_time: timeStr,
              end_time: addOneHour(timeStr),
              teacher_id: cls.default_teacher_id,
              status: "scheduled",
              suspension_category: null,
              suspension_reason: null,
              is_substitute: false,
              is_one_time: false,
            });
          }
        }
      }

      // 3. Fetch materialized exceptions (class_sessions) in range
      const classIds = classes.map((c) => c.id);
      const materializedSessions = await tx.class_sessions.findMany({
        where: {
          scheduled_class_id: { in: classIds },
          session_date: {
            gte: new Date(start_date),
            lte: new Date(end_date),
          },
        },
      });

      // 4. Overlay materialized on virtual
      const overrideMap = new Map<string, typeof materializedSessions[number]>();
      for (const ms of materializedSessions) {
        const key = `${ms.scheduled_class_id}|${ms.session_date.toISOString().split("T")[0]}`;
        overrideMap.set(key, ms);
      }

      for (const session of sessions) {
        const key = `${session.scheduled_class_id}|${session.session_date}`;
        const override = overrideMap.get(key);
        if (override) {
          session.status = override.status as "scheduled" | "suspended";
          session.suspension_category = override.suspension_category;
          session.suspension_reason = override.suspension_reason;
          if (override.assigned_teacher_id) {
            session.is_substitute = override.assigned_teacher_id !== session.teacher_id;
            session.teacher_id = override.assigned_teacher_id;
          }
        }
      }

      // 5. Fetch one-time classes in range and merge them in
      const oneTimeClasses = await tx.one_time_classes.findMany({
        where: {
          branch_id,
          class_date: { gte: new Date(start_date), lte: new Date(end_date) },
          ...(discipline_ids && discipline_ids.length > 0
            ? { discipline_id: { in: discipline_ids } }
            : {}),
        },
        include: {
          disciplines: { select: { id: true, name: true, code: true } },
        },
      });

      for (const otc of oneTimeClasses) {
        const timeStr = formatTime(otc.start_time);
        sessions.push({
          scheduled_class_id: otc.id,
          session_date: otc.class_date.toISOString().split("T")[0],
          discipline_id: otc.disciplines.id,
          discipline_name: otc.disciplines.name,
          discipline_code: otc.disciplines.code,
          start_time: timeStr,
          end_time: addOneHour(timeStr),
          teacher_id: otc.teacher_id,
          status: "scheduled",
          suspension_category: null,
          suspension_reason: null,
          is_substitute: false,
          is_one_time: true,
        });
      }

      // 6. Sort by date + start_time
      sessions.sort((a, b) => {
        const dateCompare = a.session_date.localeCompare(b.session_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });

      return sessions;
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Suspend a specific session (upsert class_sessions row).
 * Owner/Admin-branch via RLS.
 */
export async function suspendSession(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = suspendSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const row = await tx.class_sessions.upsert({
        where: {
          scheduled_class_id_session_date: {
            scheduled_class_id: parsed.data.scheduled_class_id,
            session_date: new Date(parsed.data.session_date),
          },
        },
        create: {
          scheduled_class_id: parsed.data.scheduled_class_id,
          session_date: new Date(parsed.data.session_date),
          status: "suspended",
          suspension_category: parsed.data.suspension_category,
          suspension_reason: parsed.data.suspension_reason ?? null,
        },
        update: {
          status: "suspended",
          suspension_category: parsed.data.suspension_category,
          suspension_reason: parsed.data.suspension_reason ?? null,
        },
        select: { id: true },
      });
      return row;
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Reinstate a suspended session (return to scheduled status).
 * Owner/Admin-branch via RLS.
 */
export async function reinstateSession(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = reinstateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const row = await tx.class_sessions.update({
        where: {
          scheduled_class_id_session_date: {
            scheduled_class_id: parsed.data.scheduled_class_id,
            session_date: new Date(parsed.data.session_date),
          },
        },
        data: {
          status: "scheduled",
          suspension_category: null,
          suspension_reason: null,
        },
        select: { id: true },
      });
      return row;
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Assign a teacher to a recurring class or specific session (conflict-aware).
 * Owner/Admin-branch via RLS.
 */
export async function assignTeacher(
  input: unknown
): Promise<ActionResult<AssignTeacherResult>> {
  const parsed = assignTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { target_type, scheduled_class_id, session_date, teacher_id, force } =
    parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      // Get the parent class to know day_of_week and start_time
      const parentClass = await tx.scheduled_classes.findUnique({
        where: { id: scheduled_class_id },
        select: { day_of_week: true, start_time: true },
      });

      if (!parentClass) {
        return {
          success: false,
          message: COMMON_MESSAGES.UNEXPECTED_ERROR,
        } as AssignTeacherResult;
      }

      const startTimeStr = formatTime(parentClass.start_time);

      // Detect conflicts (GLOBAL, cross-branch)
      const conflicts = await detectTeacherConflicts(
        tx,
        teacher_id,
        parentClass.day_of_week,
        startTimeStr,
        scheduled_class_id
      );

      // No conflict → assign directly
      if (conflicts.length === 0) {
        if (target_type === "recurring") {
          await tx.scheduled_classes.update({
            where: { id: scheduled_class_id },
            data: { default_teacher_id: teacher_id },
          });
        } else {
          await tx.class_sessions.upsert({
            where: {
              scheduled_class_id_session_date: {
                scheduled_class_id,
                session_date: new Date(session_date!),
              },
            },
            create: {
              scheduled_class_id,
              session_date: new Date(session_date!),
              assigned_teacher_id: teacher_id,
            },
            update: {
              assigned_teacher_id: teacher_id,
            },
          });
        }

        return {
          success: true,
          teacher_assigned: true,
          message: TEACHER_CONFLICT_MESSAGES.ASSIGNED,
        } as AssignTeacherResult;
      }

      // Conflict found, force=false → return warning
      if (!force) {
        return {
          success: false,
          conflict: true,
          conflicting_assignments: conflicts,
          requires_confirmation: true,
          message: TEACHER_CONFLICT_MESSAGES.WARNING,
        } as AssignTeacherResult;
      }

      // Conflict found, force=true → nullify prior + assign new
      const affectedClasses: AssignTeacherResult["affected_classes"] = [];

      for (const conflict of conflicts) {
        if (conflict.type === "recurring") {
          await tx.scheduled_classes.update({
            where: { id: conflict.class_id },
            data: { default_teacher_id: null },
          });
        } else {
          await tx.class_sessions.updateMany({
            where: {
              scheduled_class_id: conflict.class_id,
              assigned_teacher_id: teacher_id,
              status: "scheduled",
            },
            data: { assigned_teacher_id: null },
          });
        }

        affectedClasses.push({
          class_id: conflict.class_id,
          class_name: conflict.class_name,
          branch_name: conflict.branch_name,
          previous_teacher_removed: true,
        });
      }

      // Assign to the new target
      if (target_type === "recurring") {
        await tx.scheduled_classes.update({
          where: { id: scheduled_class_id },
          data: { default_teacher_id: teacher_id },
        });
      } else {
        await tx.class_sessions.upsert({
          where: {
            scheduled_class_id_session_date: {
              scheduled_class_id,
              session_date: new Date(session_date!),
            },
          },
          create: {
            scheduled_class_id,
            session_date: new Date(session_date!),
            assigned_teacher_id: teacher_id,
          },
          update: {
            assigned_teacher_id: teacher_id,
          },
        });
      }

      return {
        success: true,
        teacher_assigned: true,
        affected_classes: affectedClasses,
        message: TEACHER_CONFLICT_MESSAGES.ASSIGNED,
      } as AssignTeacherResult;
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get suspension report for a date range.
 * Owner sees all branches; Admin scoped to own branch via RLS.
 */
export async function getSuspensionReport(
  input: unknown
): Promise<ActionResult<SuspensionReportRow[]>> {
  const parsed = getSuspensionReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, start_date, end_date, group_by } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const sessions = await tx.class_sessions.findMany({
        where: {
          status: "suspended",
          session_date: {
            gte: new Date(start_date),
            lte: new Date(end_date),
          },
          ...(branch_id
            ? { scheduled_classes: { branch_id } }
            : {}),
        },
        include: {
          scheduled_classes: {
            include: {
              disciplines: { select: { name: true } },
              branches: { select: { name: true } },
            },
          },
        },
        orderBy: { session_date: "asc" },
      });

      // Group by period
      const groups = new Map<string, SuspensionReportRow>();

      for (const s of sessions) {
        const date = s.session_date;
        let periodKey: string;

        if (group_by === "day") {
          periodKey = date.toISOString().split("T")[0];
        } else if (group_by === "week") {
          // ISO week start (Monday)
          const d = new Date(date);
          const dayOfWeek = d.getDay();
          const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const weekStart = new Date(d.setDate(diff));
          periodKey = weekStart.toISOString().split("T")[0];
        } else {
          // month
          const d = new Date(date);
          periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }

        if (!groups.has(periodKey)) {
          groups.set(periodKey, {
            period: periodKey,
            total_suspended: 0,
            by_category: { feriado: 0, evento: 0, emergencia: 0, otro: 0 },
            sessions: [],
          });
        }

        const group = groups.get(periodKey)!;
        group.total_suspended++;
        const cat = s.suspension_category as keyof typeof group.by_category;
        if (cat && cat in group.by_category) {
          group.by_category[cat]++;
        }
        group.sessions.push({
          date: date.toISOString().split("T")[0],
          class_name: s.scheduled_classes.disciplines.name,
          category: s.suspension_category ?? "",
          reason: s.suspension_reason,
        });
      }

      return Array.from(groups.values());
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
