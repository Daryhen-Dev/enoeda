"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import { assertActiveBranchAssignment } from "@/lib/auth/assert-branch-assignment";
import {
  authorizeBranchRead,
  BRANCH_READ_ACCESS,
} from "@/lib/auth/branch-read-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertClassInContext } from "@/lib/domain/classes/branch-guard";
import {
  dateOnlyToUtcDate,
  formatDatabaseDateOnly,
  formatDateOnly,
  parseDateOnly,
} from "@/lib/date";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  TEACHER_ASSIGN_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  assignTeacherSchema,
  createMonthlyClassGroupSchema,
  createOneTimeClassSchema,
  deactivateAllFutureClassesSchema,
  deactivateScheduledClassSchema,
  deactivateScheduledClassSeriesSchema,
  getSessionsForRangeSchema,
  getSuspensionReportSchema,
  listClassSeriesSchema,
  reinstateSessionSchema,
  renameClassSeriesSchema,
  suspendSessionSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- View types ---

export interface SessionAttendanceSummary {
  record_count: number;
  present_count: number;
}

export interface SessionView {
  /** id of the scheduled_classes row, OR the one_time_classes row when is_one_time=true. */
  scheduled_class_id: string;
  session_date: string;
  discipline_id: string;
  discipline_name: string;
  discipline_code: string;
  start_time: string;
  end_time: string;
  teacher_id: string | null;
  effective_teacher_name?: string | null;
  can_view_attendance?: boolean;
  can_take_attendance?: boolean;
  attendance?: SessionAttendanceSummary;
  status: "scheduled" | "suspended";
  suspension_category: string | null;
  suspension_reason: string | null;
  is_substitute: boolean;
  /** true when this session comes from one_time_classes, not a recurring template. */
  is_one_time: boolean;
  /** Monthly group (class_series) identity — recurring occurrences only. */
  series_id?: string;
  series_name?: string;
  /** Group month as "YYYY-MM" — recurring occurrences only. */
  period_month?: string;
}

export interface AssignTeacherResult {
  teacher_assigned: boolean;
  message: string;
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

// --- Server Actions ---

/**
 * Create a monthly class group: one class_series row (the group) plus one
 * scheduled_classes row per selected weekday, all inside ONE transaction.
 * period_month is stored as the first day of the given "YYYY-MM" month and
 * every weekday row inherits the group's branch, discipline and default
 * teacher (enforced again by the composite FK). All-or-nothing: any failure
 * rolls back the group and all day rows. Owner/Admin-branch via RLS.
 */
export interface MonthlyClassGroupResult {
  series_id: string;
  class_ids: string[];
}

export async function createMonthlyClassGroup(
  input: unknown
): Promise<ActionResult<MonthlyClassGroupResult>> {
  const parsed = createMonthlyClassGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const {
    branch_id,
    discipline_id,
    default_teacher_id,
    series_name,
    period_month,
    days_of_week,
    start_time,
  } = parsed.data;

  return withAuthenticatedUser(async (tx, ctx) => {
    // Branch assignment assertion — fail-closed
    const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
    if (!branchCheck.ok) {
      throw new Error(branchCheck.error);
    }

    const seriesId = crypto.randomUUID();
    await tx.class_series.create({
      data: {
        id: seriesId,
        branch_id,
        name: series_name,
        discipline_id,
        default_teacher_id: default_teacher_id ?? null,
        // "YYYY-MM" → first day of that month (UTC midnight, like every
        // Postgres `date` value handled through lib/date).
        period_month: dateOnlyToUtcDate(`${period_month}-01`),
      },
      select: { id: true },
    });

    const classIds: string[] = [];
    for (const day_of_week of days_of_week) {
      const row = await tx.scheduled_classes.create({
        data: {
          branch_id,
          discipline_id,
          default_teacher_id: default_teacher_id ?? null,
          day_of_week,
          start_time: new Date(`1970-01-01T${start_time}:00`),
          series_id: seriesId,
        },
        select: { id: true },
      });
      classIds.push(row.id);
    }

    return { series_id: seriesId, class_ids: classIds };
  }, {
    mapTransactionError: (error) =>
      error instanceof Error &&
      (error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
        error.message.includes("permisos"))
        ? error.message
        : undefined,
  });
}

/**
 * Create a single-occurrence class on a specific date, outside the
 * monthly groups (e.g. an extra class held once this month).
 * There are no schedule restrictions any more: overlapping classes are
 * allowed and no conflict pre-check runs. The only remaining overlap
 * guard is the DB EXCLUDE constraint among one_time_classes rows of the
 * same branch/date/time, mapped to a user-facing message below.
 * Owner/Admin-branch via RLS.
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
    const result = await withAuthenticatedUser(
      async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      const created = await tx.one_time_classes.create({
        data: {
          branch_id,
          discipline_id,
          teacher_id: teacher_id ?? null,
          class_date: new Date(class_date),
          start_time: new Date(`1970-01-01T${start_time}:00`),
        },
        select: { id: true },
      });

      return { id: created.id, error: null };
      },
      {
        mapTransactionError: (error) =>
          error instanceof Error &&
          (error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
            error.message.includes("permisos"))
            ? error.message
            : undefined,
      }
    );

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
    }

    return { success: true, data: { id: result.data.id } };
  } catch {
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
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, parsed.data.branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      // Branch context enforcement (fail-closed)
      const guard = await assertClassInContext(tx, parsed.data.id, parsed.data.branch_id);
      if (!guard.ok) {
        throw new Error(guard.error);
      }

      return tx.scheduled_classes.update({
        where: { id: parsed.data.id },
        data: { is_active: false },
        select: { id: true },
      });
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_MISMATCH ||
          error.message === CLASS_MESSAGES.NOT_FOUND ||
          error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Deactivate ALL active scheduled_classes rows sharing the same series_id
 * (the materialized series identity created with the class or batch).
 * Used to remove a whole weekly series at once. History is preserved
 * (soft-deactivate is_active=false; never deletes).
 *
 * The caller passes EITHER any one row of the series (scheduled_class_id —
 * the calendar dialog) OR the series identity itself (series_id — the
 * concurrencias section); the schema rejects passing both or neither.
 * When scheduled_class_id is given, its series_id is resolved inside the
 * transaction. When series_id is given, the catalog row is verified to
 * belong to the caller's branch. Either way the target is absent →
 * CLASS_MESSAGES.NOT_FOUND.
 *
 * Authorization: unlike deactivateScheduledClass there is no single row to
 * run assertClassInContext against for the bulk update — the active
 * branch-assignment assertion plus RLS inside withAuthenticatedUser scope
 * the lookup and the bulk update to the caller's own branch.
 * Owner/Admin-branch via RLS.
 */
export async function deactivateScheduledClassSeries(
  input: unknown
): Promise<ActionResult<{ deactivated: number }>> {
  const parsed = deactivateScheduledClassSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, scheduled_class_id, series_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      // Resolve the series identity (RLS scopes the lookups to the
      // caller's branch).
      let resolvedSeriesId: string | null = null;
      if (scheduled_class_id) {
        const row = await tx.scheduled_classes.findFirst({
          where: { id: scheduled_class_id, branch_id },
          select: { series_id: true },
        });
        if (!row || row.series_id === null) {
          throw new Error(CLASS_MESSAGES.NOT_FOUND);
        }
        resolvedSeriesId = row.series_id;
      } else if (series_id) {
        const series = await tx.class_series.findFirst({
          where: { id: series_id, branch_id },
          select: { id: true },
        });
        if (!series) {
          throw new Error(CLASS_MESSAGES.NOT_FOUND);
        }
        resolvedSeriesId = series.id;
      }

      if (!resolvedSeriesId) {
        throw new Error(CLASS_MESSAGES.NOT_FOUND);
      }

      const batch = await tx.scheduled_classes.updateMany({
        where: {
          branch_id,
          series_id: resolvedSeriesId,
          is_active: true,
        },
        data: { is_active: false },
      });

      // Deactivate the monthly group itself, so the calendar stops
      // rendering its occurrences from today onward and clone flows
      // can skip inactive groups.
      await tx.class_series.updateMany({
        where: {
          id: resolvedSeriesId,
          branch_id,
          is_active: true,
        },
        data: { is_active: false },
      });

      return { deactivated: batch.count };
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.NOT_FOUND ||
          error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Deactivate ALL future classes of a branch in one step: every active
 * recurring template (scheduled_classes — the "concurrencias").
 * One-time classes are deliberately NOT touched: "quitar todo lo futuro"
 * targets recurring series only, and one_time_classes.is_active stays
 * unused for now.
 * History is preserved (soft-deactivate is_active=false; never deletes):
 * past sessions stay visible through the existing resolver gates.
 *
 * Authorization: the active branch-assignment assertion plus RLS inside
 * withAuthenticatedUser scope the bulk update to the caller's own
 * branch. Owner/Admin-branch via RLS.
 */
export async function deactivateAllFutureClasses(
  input: unknown
): Promise<ActionResult<{ deactivated: number }>> {
  const parsed = deactivateAllFutureClassesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      const recurringUpdate = await tx.scheduled_classes.updateMany({
        where: { branch_id, is_active: true },
        data: { is_active: false },
      });

      return { deactivated: recurringUpdate.count };
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * One row per monthly class group (class_series) of a branch, for the
 * concurrencias admin section. Each group carries its discipline, period
 * month ("YYYY-MM"), active state, default teacher and roster student
 * count; the weekday slots and active row count come from its
 * scheduled_classes rows. An optional period_month filter ("YYYY-MM")
 * scopes the listing to a single month.
 * The teacher name is resolved through user_profiles via the admin
 * client (same pattern as listBranchStaff).
 * Owner/Admin-branch via RLS.
 */
export interface ClassSeriesView {
  series_id: string;
  name: string;
  discipline_id: string;
  discipline_name: string;
  /** Group month as "YYYY-MM". */
  period_month: string;
  days_of_week: number[];
  start_time: string;
  default_teacher_id: string | null;
  teacher_name: string | null;
  active_row_count: number;
  is_active: boolean;
  is_all_inactive: boolean;
  roster_student_count: number;
}

export async function listClassSeries(
  input: unknown
): Promise<ActionResult<ClassSeriesView[]>> {
  const parsed = listClassSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, period_month } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        return { __branchError: branchCheck.error } as const;
      }

      // The class_series catalog is the authoritative list of groups.
      const seriesRows = await tx.class_series.findMany({
        where: {
          branch_id,
          ...(period_month
            ? { period_month: dateOnlyToUtcDate(`${period_month}-01`) }
            : {}),
        },
        include: {
          disciplines: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });

      const classRows = await tx.scheduled_classes.findMany({
        where: { branch_id },
        select: {
          series_id: true,
          is_active: true,
          day_of_week: true,
          start_time: true,
          default_teacher_id: true,
        },
      });

      const rowsBySeriesId = new Map<string, typeof classRows>();
      for (const row of classRows) {
        const bucket = rowsBySeriesId.get(row.series_id);
        if (bucket) {
          bucket.push(row);
        } else {
          rowsBySeriesId.set(row.series_id, [row]);
        }
      }

      // Roster student count per group (0 when the group has no roster).
      const seriesIds = seriesRows.map((series) => series.id);
      const rosterCounts = new Map<string, number>();
      if (seriesIds.length > 0) {
        const rosterGroups = await tx.class_series_students.groupBy({
          by: ["series_id"],
          where: { series_id: { in: seriesIds } },
          _count: { _all: true },
        });
        for (const group of rosterGroups) {
          rosterCounts.set(group.series_id, group._count._all);
        }
      }

      const views: ClassSeriesView[] = [];
      const teacherIds = new Set<string>();
      for (const series of seriesRows) {
        const rows = rowsBySeriesId.get(series.id) ?? [];
        const firstRow = rows[0];
        // A catalog row without any class rows cannot happen today (the
        // rows are created together with the group and cascade-delete);
        // skip defensively if it ever does.
        if (!firstRow) continue;

        const activeRows = rows.filter((row) => row.is_active);
        const teacherId = series.default_teacher_id;
        if (teacherId) {
          teacherIds.add(teacherId);
        }

        const periodMonth = formatDatabaseDateOnly(series.period_month).slice(0, 7);

        views.push({
          series_id: series.id,
          name: series.name,
          discipline_id: series.disciplines.id,
          discipline_name: series.disciplines.name,
          period_month: periodMonth,
          days_of_week: [
            ...new Set(activeRows.map((row) => row.day_of_week)),
          ].sort((a, b) => a - b),
          start_time: formatTime(firstRow.start_time),
          default_teacher_id: teacherId ?? null,
          teacher_name: null,
          active_row_count: activeRows.length,
          is_active: series.is_active,
          is_all_inactive: activeRows.length === 0,
          roster_student_count: rosterCounts.get(series.id) ?? 0,
        });
      }

      const teacherNameById = new Map<string, string>();
      if (teacherIds.size > 0) {
        const admin = createAdminClient();
        const { data: profiles, error: profilesError } = await admin
          .from("user_profiles")
          .select("user_id, first_name, surname")
          .in("user_id", [...teacherIds]);
        if (profilesError) {
          throw new Error(COMMON_MESSAGES.UNEXPECTED_ERROR);
        }
        for (const profile of profiles ?? []) {
          const displayName = [profile.first_name, profile.surname]
            .filter((name): name is string => Boolean(name))
            .join(" ");
          if (displayName) {
            teacherNameById.set(profile.user_id, displayName);
          }
        }
      }
      for (const view of views) {
        view.teacher_name = view.default_teacher_id
          ? teacherNameById.get(view.default_teacher_id) ?? null
          : null;
      }

      return views;
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    if (result.data && "__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }
    return { success: true, data: result.data as ClassSeriesView[] };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Rename a concurrencia (class_series row) within the caller's branch.
 * Soft operation only (no deletes): the row is updated in place.
 * NOT_FOUND when no catalog row matches id + branch.
 * Owner/Admin-branch via RLS.
 */
export async function renameClassSeries(
  input: unknown
): Promise<ActionResult<{ series_id: string }>> {
  const parsed = renameClassSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, series_id, name } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      const updated = await tx.class_series.updateMany({
        where: { id: series_id, branch_id },
        data: { name },
      });
      if (updated.count === 0) {
        throw new Error(CLASS_MESSAGES.NOT_FOUND);
      }

      return { series_id };
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.NOT_FOUND ||
          error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Get sessions for a date range (virtual expansion + materialized overlay).
 * Any authenticated user with branch access via RLS.
 * Validates caller has active branch assignment internally (fail-closed).
 */
export async function getSessionsForRange(
  input: unknown
): Promise<ActionResult<SessionView[]>> {
  const parsed = getSessionsForRangeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const {
    branch_id,
    start_date,
    end_date,
    discipline_ids,
    allow_global_admin_read,
  } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      let isGlobalAdminReadOnly = false;

      if (!branchCheck.ok) {
        if (allow_global_admin_read !== true) {
          return { __branchError: branchCheck.error } as const;
        }

        const branchRead = await authorizeBranchRead(tx, ctx, branch_id, {
          allowGlobalAdminRead: true,
        });
        if (branchRead.access === BRANCH_READ_ACCESS.DENIED) {
          return { __branchError: branchCheck.error } as const;
        }

        isGlobalAdminReadOnly =
          branchRead.access === BRANCH_READ_ACCESS.GLOBAL_ADMIN_READ_ONLY;
      }

      const start = parseDateOnly(start_date);
      const end = parseDateOnly(end_date);
      // Load active AND inactive templates: past occurrences of deactivated
      // templates and inactive groups must stay visible (with attendance);
      // occurrences from today onward are hidden below. Occurrences only
      // ever render inside their group's month (period_month .. its last
      // day), because class_series is the monthly group.
      const classes = await tx.scheduled_classes.findMany({
        where: {
          branch_id,
          ...(discipline_ids && discipline_ids.length > 0
            ? { discipline_id: { in: discipline_ids } }
            : {}),
        },
        include: {
          disciplines: { select: { id: true, name: true, code: true } },
          class_series: {
            select: { id: true, name: true, period_month: true, is_active: true },
          },
        },
      });

      // Group month window per class: ["YYYY-MM-01", "YYYY-MM-<last>"].
      const groupMonthByClassId = new Map<
        string,
        { monthStart: string; monthEnd: string; periodMonth: string; isActive: boolean }
      >();
      for (const cls of classes) {
        const monthStart = formatDatabaseDateOnly(cls.class_series.period_month);
        const [year, month] = monthStart.split("-").map(Number);
        // Last day of the month: day 0 of the following UTC month.
        const monthEnd = formatDatabaseDateOnly(new Date(Date.UTC(year, month, 0)));
        groupMonthByClassId.set(cls.id, {
          monthStart,
          monthEnd,
          periodMonth: monthStart.slice(0, 7),
          isActive: cls.class_series.is_active,
        });
      }

      // Expand recurring virtual sessions by iterating dates.
      const sessions: SessionView[] = [];
      // Server-local "today" as YYYY-MM-DD, produced with the same
      // formatDateOnly pipeline used for session_date strings, so the
      // comparison below stays consistent.
      const todayStr = formatDateOnly(new Date());
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const isoDay = jsToIsoDayOfWeek(d.getDay());
        const dateStr = formatDateOnly(d);

        for (const cls of classes) {
          const group = groupMonthByClassId.get(cls.id);
          if (!group) continue;
          // Occurrences only exist inside the group's month.
          const inGroupMonth =
            dateStr >= group.monthStart && dateStr <= group.monthEnd;
          // Inactive groups behave like inactive templates: they only
          // contribute PAST occurrences (strictly before today); active
          // templates behave exactly as before.
          const renders =
            (group.isActive && cls.is_active) || dateStr < todayStr;
          if (
            cls.day_of_week === isoDay &&
            inGroupMonth &&
            renders
          ) {
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
              series_id: cls.class_series.id,
              series_name: cls.class_series.name,
              period_month: group.periodMonth,
              ...(isGlobalAdminReadOnly
                ? {}
                : { can_view_attendance: true }),
              status: "scheduled",
              suspension_category: null,
              suspension_reason: null,
              is_substitute: false,
              is_one_time: false,
            });
          }
        }
      }

      // Resolve the effective teacher for each recurring occurrence.
      if (sessions.length > 0) {
        const resolvedRows = await tx.$queryRaw<
          { class_id: string; session_date: string; resolve_effective_teacher: string | null }[]
        >`SELECT unnest(${sessions.map((s) => s.scheduled_class_id)}::uuid[]) AS class_id,
                 unnest(${sessions.map((s) => s.session_date)}::date[]) AS session_date,
                 private.resolve_effective_teacher(
                   unnest(${sessions.map((s) => s.scheduled_class_id)}::uuid[]),
                   unnest(${sessions.map((s) => s.session_date)}::date[])
                 ) AS resolve_effective_teacher`;

        const resolvedMap = new Map<string, string | null>();
        for (const row of resolvedRows) {
          resolvedMap.set(`${row.class_id}|${row.session_date}`, row.resolve_effective_teacher);
        }
        for (const session of sessions) {
          const resolved = resolvedMap.get(`${session.scheduled_class_id}|${session.session_date}`);
          if (resolved) {
            session.teacher_id = resolved;
          }
        }
      }

      const classIds = classes.map((cls) => cls.id);
      const materializedSessions = classIds.length > 0
        ? await tx.class_sessions.findMany({
            where: {
              scheduled_class_id: { in: classIds },
              session_date: { gte: start, lte: end },
            },
          })
        : [];

      const overrideMap = new Map<string, typeof materializedSessions[number]>();
      for (const materializedSession of materializedSessions) {
        const key = `${materializedSession.scheduled_class_id}|${formatDatabaseDateOnly(
          materializedSession.session_date
        )}`;
        overrideMap.set(key, materializedSession);
      }

      const defaultTeacherByClassId = new Map<string, string | null>();
      for (const cls of classes) {
        defaultTeacherByClassId.set(cls.id, cls.default_teacher_id);
      }

      for (const session of sessions) {
        const override = overrideMap.get(`${session.scheduled_class_id}|${session.session_date}`);
        if (override) {
          session.status = override.status as "scheduled" | "suspended";
          session.suspension_category = override.suspension_category;
          session.suspension_reason = override.suspension_reason;
          if (override.assigned_teacher_id) {
            session.is_substitute =
              override.assigned_teacher_id !==
              defaultTeacherByClassId.get(session.scheduled_class_id);
          }
        }
      }

      // Merge in one-time sessions even when there are no recurring classes.
      // Inactive one-time classes only contribute PAST occurrences
      // (strictly before today); active ones behave exactly as before —
      // mirrors the recurring-template gate above.
      const oneTimeClasses = await tx.one_time_classes.findMany({
        where: {
          branch_id,
          class_date: { gte: start, lte: end },
          OR: [
            { is_active: true },
            { class_date: { lt: parseDateOnly(todayStr) } },
          ],
          ...(discipline_ids && discipline_ids.length > 0
            ? { discipline_id: { in: discipline_ids } }
            : {}),
        },
        include: {
          disciplines: { select: { id: true, name: true, code: true } },
        },
      });

      for (const oneTimeClass of oneTimeClasses) {
        const timeStr = formatTime(oneTimeClass.start_time);
        sessions.push({
          scheduled_class_id: oneTimeClass.id,
          session_date: formatDateOnly(oneTimeClass.class_date),
          discipline_id: oneTimeClass.disciplines.id,
          discipline_name: oneTimeClass.disciplines.name,
          discipline_code: oneTimeClass.disciplines.code,
          start_time: timeStr,
          end_time: addOneHour(timeStr),
          teacher_id: oneTimeClass.teacher_id,
          ...(isGlobalAdminReadOnly
            ? {}
            : { can_view_attendance: true }),
          status: "scheduled",
          suspension_category: null,
          suspension_reason: null,
          is_substitute: false,
          is_one_time: true,
        });
      }

      const canManageAttendance = ctx.assignments.some(
        (assignment) =>
          assignment.role === "admin" && assignment.branchId === branch_id
      );
      if (!isGlobalAdminReadOnly && !canManageAttendance) {
        const assignedSessions = sessions.filter(
          (session) => session.teacher_id === ctx.userId
        );
        sessions.splice(0, sessions.length, ...assignedSessions);
      }

      if (!isGlobalAdminReadOnly) {
        for (const session of sessions) {
          session.can_take_attendance =
            canManageAttendance || session.teacher_id === ctx.userId;
        }
      }

      const teacherIds = [
        ...new Set(
          sessions
            .map((session) => session.teacher_id)
            .filter((teacherId): teacherId is string => teacherId !== null)
        ),
      ];
      const teacherNameById = new Map<string, string>();
      if (!isGlobalAdminReadOnly && teacherIds.length > 0) {
        const admin = createAdminClient();
        const { data: teacherRoles, error: teacherRolesError } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("branch_id", branch_id)
          .eq("role", "teacher")
          .is("revoked_at", null)
          .in("user_id", teacherIds);
        if (teacherRolesError) {
          throw new Error(COMMON_MESSAGES.UNEXPECTED_ERROR);
        }

        const authorizedTeacherIds = (teacherRoles ?? []).map((teacherRole) => teacherRole.user_id);
        if (authorizedTeacherIds.length > 0) {
          const { data: teacherProfiles, error: teacherProfilesError } = await admin
            .from("user_profiles")
            .select("user_id, first_name, surname")
            .in("user_id", authorizedTeacherIds);
          if (teacherProfilesError) {
            throw new Error(COMMON_MESSAGES.UNEXPECTED_ERROR);
          }

          for (const profile of teacherProfiles ?? []) {
            const displayName = [profile.first_name, profile.surname]
              .filter((name): name is string => Boolean(name))
              .join(" ");
            if (displayName) {
              teacherNameById.set(profile.user_id, displayName);
            }
          }
        }
      }
      for (const session of sessions) {
        session.effective_teacher_name = session.teacher_id
          ? teacherNameById.get(session.teacher_id) ?? null
          : null;
      }

      if (!isGlobalAdminReadOnly) {
        const attendanceSessionFilters = sessions.map((session) =>
          session.is_one_time
            ? { one_time_class_id: session.scheduled_class_id }
            : {
                scheduled_class_id: session.scheduled_class_id,
                session_date: parseDateOnly(session.session_date),
              }
        );
        const attendanceRows = attendanceSessionFilters.length > 0
          ? await tx.attendance.findMany({
              where: { OR: attendanceSessionFilters },
              select: {
                scheduled_class_id: true,
                one_time_class_id: true,
                session_date: true,
                attended: true,
              },
            })
          : [];
        const attendanceBySessionKey = new Map<string, SessionAttendanceSummary>();
        for (const attendance of attendanceRows) {
          const key = attendance.scheduled_class_id
            ? `recurring:${attendance.scheduled_class_id}:${formatDatabaseDateOnly(attendance.session_date)}`
            : attendance.one_time_class_id
              ? `one-time:${attendance.one_time_class_id}`
              : null;
          if (!key) continue;

          const summary = attendanceBySessionKey.get(key) ?? {
            record_count: 0,
            present_count: 0,
          };
          summary.record_count += 1;
          if (attendance.attended) {
            summary.present_count += 1;
          }
          attendanceBySessionKey.set(key, summary);
        }
        for (const session of sessions) {
          const key = session.is_one_time
            ? `one-time:${session.scheduled_class_id}`
            : `recurring:${session.scheduled_class_id}:${session.session_date}`;
          session.attendance = attendanceBySessionKey.get(key) ?? {
            record_count: 0,
            present_count: 0,
          };
        }
      }

      sessions.sort((a, b) => {
        const dateCompare = a.session_date.localeCompare(b.session_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });

      return sessions;
    });

    if (!result.success) return result;
    if (result.data && "__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }
    return { success: true, data: result.data as SessionView[] };
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
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, parsed.data.branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      // Branch context enforcement (fail-closed)
      const guard = await assertClassInContext(
        tx,
        parsed.data.scheduled_class_id,
        parsed.data.branch_id
      );
      if (!guard.ok) {
        throw new Error(guard.error);
      }

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
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_MISMATCH ||
          error.message === CLASS_MESSAGES.NOT_FOUND ||
          error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
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
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, parsed.data.branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      // Branch context enforcement (fail-closed)
      const guard = await assertClassInContext(
        tx,
        parsed.data.scheduled_class_id,
        parsed.data.branch_id
      );
      if (!guard.ok) {
        throw new Error(guard.error);
      }

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
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_MISMATCH ||
          error.message === CLASS_MESSAGES.NOT_FOUND ||
          error.message === CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED ||
          error.message.includes("permisos"))
          ? error.message
          : undefined,
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Assign a teacher to a recurring class or specific session.
 * There are no schedule restrictions any more: no conflict detection
 * runs and the assignment always applies directly.
 * Owner/Admin-branch via RLS.
 */
export async function assignTeacher(
  input: unknown
): Promise<ActionResult<AssignTeacherResult>> {
  const parsed = assignTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { target_type, scheduled_class_id, session_date, teacher_id, branch_id } =
    parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Branch assignment assertion — fail-closed
      const branchCheck = assertActiveBranchAssignment(ctx, branch_id);
      if (!branchCheck.ok) {
        throw new Error(branchCheck.error);
      }

      // Branch context enforcement (fail-closed)
      const guard = await assertClassInContext(tx, scheduled_class_id, branch_id);
      if (!guard.ok) {
        throw new Error(guard.error);
      }

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
        teacher_assigned: true,
        message: TEACHER_ASSIGN_MESSAGES.ASSIGNED,
      } as AssignTeacherResult;
    }, {
      mapTransactionError: (error) =>
        error instanceof Error &&
        (error.message === CLASS_MESSAGES.BRANCH_MISMATCH ||
          error.message === CLASS_MESSAGES.NOT_FOUND)
          ? error.message
          : undefined,
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
