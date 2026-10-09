/**
 * getSessionsForRange — effective teacher resolver integration.
 * Verifies $queryRaw call to resolve_effective_teacher per occurrence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { formatDateOnly, parseDateOnly } from "@/lib/date";

vi.mock("server-only", () => ({}));
const mockQueryRaw = vi.fn();
const mockFindMany = vi.fn();
const mockAdminQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  in: vi.fn(),
};
mockAdminQuery.select.mockReturnValue(mockAdminQuery);
mockAdminQuery.eq.mockReturnValue(mockAdminQuery);
mockAdminQuery.is.mockReturnValue(mockAdminQuery);
mockAdminQuery.in.mockResolvedValue({ data: [], error: null });
const mockTx = {
  scheduled_classes: { findMany: mockFindMany },
  class_sessions: { findMany: vi.fn().mockResolvedValue([]) },
  one_time_classes: { findMany: vi.fn().mockResolvedValue([]) },
  attendance: { findMany: vi.fn().mockResolvedValue([]) },
  $queryRaw: mockQueryRaw,
};
const mockWithAuth = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => mockAdminQuery }),
}));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: (...a: unknown[]) => mockWithAuth(...a) }));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({ assertActiveBranchAssignment: () => ({ ok: true }) }));

import { getSessionsForRange } from "./actions";

const GROUP_A = "77777777-8888-9999-8444-555555555555";
const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const CLASS = "11111111-2222-3333-8444-555555555555";
const ONE_TIME_CLASS = "33333333-4444-5555-8666-777777777777";
const T_A = "aaaa1111-2222-3333-8444-555555555555";
const T_B = "bbbb1111-2222-3333-8444-555555555555";

function setupAuth() {
  mockWithAuth.mockImplementation(async (fn: (tx: typeof mockTx, ctx: {
    userId: string;
    roles: string[];
    assignments: Array<{ role: string; branchId: string }>;
  }) => Promise<unknown>) => {
    const ctx = { userId: "u1", roles: ["admin"], assignments: [{ role: "admin", branchId: BRANCH }] };
    return { success: true, data: await fn(mockTx, ctx) };
  });
}

/** Current month as "YYYY-MM" — the default group month for helpers. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function makeClass(teacherId: string, isActive = true, group?: { periodMonth: string; isActive: boolean }) {
  return {
    id: CLASS,
    day_of_week: 0,
    start_time: new Date("1970-01-01T08:00:00Z"),
    default_teacher_id: teacherId,
    is_active: isActive,
    disciplines: { id: "d1", name: "Yoga", code: "YG" },
    class_series: {
      id: GROUP_A,
      name: "Yoga mensual",
      period_month: new Date(`${group?.periodMonth ?? currentMonth()}-01T00:00:00Z`),
      is_active: group?.isActive ?? true,
    },
  };
}

function makeOneTimeClass(opts: {
  classDate: string;
  isActive: boolean;
  id?: string;
}) {
  return {
    id: opts.id ?? ONE_TIME_CLASS,
    branch_id: BRANCH,
    class_date: parseDateOnly(opts.classDate),
    start_time: new Date("1970-01-01T10:00:00"),
    teacher_id: null,
    is_active: opts.isActive,
    disciplines: { id: "d1", name: "Yoga", code: "YG" },
  };
}

/**
 * Mimic the DB-side one-time merge filter: the class_date range plus the
 * (is_active = true OR class_date < today) gate the resolver must send.
 */
function setupOneTimeRows(rows: ReturnType<typeof makeOneTimeClass>[]) {
  mockTx.one_time_classes.findMany.mockImplementation(
    async ({
      where,
    }: {
      where: {
        class_date: { gte: Date; lte: Date };
        OR?: Array<{ is_active?: boolean; class_date?: { lt: Date } }>;
      };
    }) => {
      const gate = where.OR?.find(
        (clause) => clause.class_date !== undefined
      )?.class_date?.lt;
      return rows.filter(
        (row) =>
          row.class_date >= where.class_date.gte &&
          row.class_date <= where.class_date.lte &&
          (row.is_active || (gate !== undefined && row.class_date < gate))
      );
    }
  );
}

/** Guarantee a Monday strictly before today (within the last 7 days). */
function pastMondayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return formatDateOnly(d);
}

describe("getSessionsForRange resolver integration", () => {
  beforeEach(() => { vi.clearAllMocks(); mockTx.class_sessions.findMany.mockResolvedValue([]); mockTx.one_time_classes.findMany.mockResolvedValue([]); });

  it("calls $queryRaw and uses resolved teacher instead of default_teacher_id", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A, true, { periodMonth: "2026-09", isActive: true })]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: T_B }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(r.data![0].teacher_id).toBe(T_B);
  });

  it("falls back to default_teacher_id when resolver returns null", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A, true, { periodMonth: "2026-09", isActive: true })]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: null }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(r.data![0].teacher_id).toBe(T_A);
  });

  it("preserves override teacher from class_sessions", async () => {
    const T_OVR = "cccc1111-2222-3333-8444-555555555555";
    mockFindMany.mockResolvedValue([makeClass(T_A, true, { periodMonth: "2026-09", isActive: true })]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: T_OVR }]);
    mockTx.class_sessions.findMany.mockResolvedValue([{ scheduled_class_id: CLASS, session_date: new Date("2026-09-07"), status: "scheduled", suspension_category: null, suspension_reason: null, assigned_teacher_id: T_OVR }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(r.data![0].teacher_id).toBe(T_OVR);
  });

  it("produces occurrences ONLY inside the group month and stamps series data", async () => {
    // A range fully inside the group's month must still render weekly
    // occurrences (the gate only cuts dates OUTSIDE the month).
    mockFindMany.mockResolvedValue([makeClass(T_A, true, { periodMonth: "2026-09", isActive: true })]);
    mockQueryRaw.mockResolvedValue([]);
    setupAuth();
    // Range spans two months; the group belongs to 2026-09 only.
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: "2026-09-07",
      end_date: "2026-10-12",
    });
    expect(r.success).toBe(true);
    const classSessions = r.data!.filter((s) => s.scheduled_class_id === CLASS);
    // Every Monday of September 2026 renders; October Mondays do not.
    expect(classSessions.map((s) => s.session_date)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(classSessions[0].series_id).toBe(GROUP_A);
    expect(classSessions[0].series_name).toBe("Yoga mensual");
    expect(classSessions[0].period_month).toBe("2026-09");
  });

  it("treats an inactive group like an inactive template: past occurrences only", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A, true, { periodMonth: "2026-09", isActive: false })]);
    mockQueryRaw.mockResolvedValue([]);
    setupAuth();
    const todayStr = formatDateOnly(new Date());
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: "2026-09-01",
      end_date: "2026-09-30",
    });
    expect(r.success).toBe(true);
    const classSessions = r.data!.filter((s) => s.scheduled_class_id === CLASS);
    expect(
      classSessions.every((s) => s.session_date < todayStr)
    ).toBe(true);
  });

  it("yields past occurrences only for an inactive template", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A, false)]);
    mockQueryRaw.mockResolvedValue([]);
    setupAuth();
    const todayStr = formatDateOnly(new Date());
    const start = new Date();
    start.setDate(start.getDate() - 10);
    const end = new Date();
    end.setDate(end.getDate() + 10);
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: formatDateOnly(start),
      end_date: formatDateOnly(end),
    });
    expect(r.success).toBe(true);
    const classSessions = r.data!.filter((s) => s.scheduled_class_id === CLASS);
    // The 21-day window always contains a Monday strictly before today.
    expect(classSessions.length).toBeGreaterThan(0);
    expect(
      classSessions.every((s) => s.session_date < todayStr)
    ).toBe(true);
  });

  it("keeps active template occurrences from today onward unchanged", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A, true)]);
    mockQueryRaw.mockResolvedValue([]);
    setupAuth();
    const todayStr = formatDateOnly(new Date());
    const start = new Date();
    start.setDate(start.getDate() - 10);
    const end = new Date();
    end.setDate(end.getDate() + 10);
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: formatDateOnly(start),
      end_date: formatDateOnly(end),
    });
    expect(r.success).toBe(true);
    const classSessions = r.data!.filter((s) => s.scheduled_class_id === CLASS);
    // Any 10-day window after today always contains the next Monday.
    expect(
      classSessions.some((s) => s.session_date > todayStr)
    ).toBe(true);
  });

  it("keeps attendance overlay intact for past inactive occurrences", async () => {
    const pastDate = pastMondayDateStr();
    mockFindMany.mockResolvedValue([makeClass(T_A, false)]);
    mockQueryRaw.mockResolvedValue([]);
    mockTx.attendance.findMany.mockResolvedValue([
      {
        scheduled_class_id: CLASS,
        one_time_class_id: null,
        session_date: new Date(pastDate),
        attended: true,
      },
    ]);
    setupAuth();
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: pastDate,
      end_date: pastDate,
    });
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].scheduled_class_id).toBe(CLASS);
    expect(r.data![0].attendance).toEqual({
      record_count: 1,
      present_count: 1,
    });
  });

  it("sends the (is_active = true OR class_date < today) gate to the one-time merge query", async () => {
    mockFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    setupAuth();
    await getSessionsForRange({
      branch_id: BRANCH,
      start_date: "2026-09-01",
      end_date: "2026-09-30",
    });
    expect(mockTx.one_time_classes.findMany).toHaveBeenCalledTimes(1);
    const { where } = mockTx.one_time_classes.findMany.mock.calls[0][0] as {
      where: {
        OR?: Array<{ is_active?: boolean; class_date?: { lt: Date } }>;
      };
    };
    expect(where.OR).toBeDefined();
    expect(where.OR).toContainEqual({ is_active: true });
    const pastGate = where.OR!.find(
      (clause) => clause.class_date !== undefined
    )?.class_date?.lt;
    expect(pastGate).toBeDefined();
    // Same server-local midnight the recurring gate derives from.
    expect(pastGate!.getTime()).toBe(parseDateOnly(formatDateOnly(new Date())).getTime());
  });

  it("returns an inactive one-time class with a past date", async () => {
    mockFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    const pastDate = pastMondayDateStr();
    setupOneTimeRows([makeOneTimeClass({ classDate: pastDate, isActive: false })]);
    setupAuth();
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: pastDate,
      end_date: pastDate,
    });
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].scheduled_class_id).toBe(ONE_TIME_CLASS);
    expect(r.data![0].is_one_time).toBe(true);
    expect(r.data![0].session_date).toBe(pastDate);
  });

  it("hides inactive one-time classes from today onward but keeps active ones", async () => {
    mockFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    const todayStr = formatDateOnly(new Date());
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = formatDateOnly(future);
    setupOneTimeRows([
      makeOneTimeClass({ classDate: todayStr, isActive: true, id: "44444444-4444-4444-8444-444444444444" }),
      makeOneTimeClass({ classDate: todayStr, isActive: false }),
      makeOneTimeClass({ classDate: futureStr, isActive: false }),
    ]);
    setupAuth();
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: todayStr,
      end_date: futureStr,
    });
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].scheduled_class_id).toBe("44444444-4444-4444-8444-444444444444");
    expect(r.data![0].is_one_time).toBe(true);
  });

  it("treats active one-time classes exactly as before", async () => {
    mockFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    const todayStr = formatDateOnly(new Date());
    setupOneTimeRows([makeOneTimeClass({ classDate: todayStr, isActive: true })]);
    setupAuth();
    const r = await getSessionsForRange({
      branch_id: BRANCH,
      start_date: todayStr,
      end_date: todayStr,
    });
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].scheduled_class_id).toBe(ONE_TIME_CLASS);
  });
});
