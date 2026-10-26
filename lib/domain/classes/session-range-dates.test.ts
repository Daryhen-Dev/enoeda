/**
 * getSessionsForRange sends every `date` comparison to Prisma as the
 * UTC-midnight instant of its calendar day (T5 of
 * odd/tasks/date-only-writes.md).
 *
 * `class_date` and `session_date` are Postgres `date` columns. A local-midnight
 * bound or filter compares against the wrong instant on any server east of
 * UTC. The day-by-day walk that builds occurrences keeps local calendar
 * arithmetic (S2); only the values that cross into Prisma change (S1). The
 * assertions pin exact instants so they fail on any machine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mockQueryRaw = vi.fn().mockResolvedValue([]);
const mockAdminQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn() };
mockAdminQuery.select.mockReturnValue(mockAdminQuery);
mockAdminQuery.eq.mockReturnValue(mockAdminQuery);
mockAdminQuery.is.mockReturnValue(mockAdminQuery);
mockAdminQuery.in.mockResolvedValue({ data: [], error: null });

const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const CLASS = "11111111-2222-3333-8444-555555555555";
const GROUP = "77777777-8888-9999-8444-555555555555";
const TEACHER = "aaaa1111-2222-3333-8444-555555555555";

const mockTx = {
  scheduled_classes: { findMany: vi.fn() },
  class_sessions: { findMany: vi.fn() },
  one_time_classes: { findMany: vi.fn() },
  attendance: { findMany: vi.fn() },
  $queryRaw: mockQueryRaw,
};
const mockWithAuth = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => mockAdminQuery }),
}));
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...a: unknown[]) => mockWithAuth(...a),
}));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({
  assertActiveBranchAssignment: () => ({ ok: true }),
}));

import { getSessionsForRange } from "./actions";

/** A Monday template in a September 2026 group, active. */
function mondayTemplate() {
  return {
    id: CLASS,
    day_of_week: 0,
    start_time: new Date("1970-01-01T08:00:00Z"),
    default_teacher_id: TEACHER,
    is_active: true,
    disciplines: { id: "d1", name: "Karate", code: "KA" },
    class_series: {
      id: GROUP,
      name: "Karate septiembre",
      period_month: new Date("2026-09-01T00:00:00Z"),
      is_active: true,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.scheduled_classes.findMany.mockResolvedValue([mondayTemplate()]);
  mockTx.class_sessions.findMany.mockResolvedValue([]);
  mockTx.one_time_classes.findMany.mockResolvedValue([]);
  mockTx.attendance.findMany.mockResolvedValue([]);
  mockQueryRaw.mockResolvedValue([]);
  mockWithAuth.mockImplementation(
    async (fn: (tx: typeof mockTx, ctx: unknown) => Promise<unknown>) => ({
      success: true,
      data: await fn(mockTx, {
        userId: "u1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH }],
      }),
    })
  );
});

const RANGE = { branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-13" };

describe("getSessionsForRange date filters", () => {
  it("bounds the materialized sessions with UTC-midnight instants", async () => {
    await getSessionsForRange(RANGE);

    const where = mockTx.class_sessions.findMany.mock.calls[0][0].where;
    expect(where.session_date.gte.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(where.session_date.lte.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("bounds the one-time classes with UTC-midnight instants", async () => {
    await getSessionsForRange(RANGE);

    const where = mockTx.one_time_classes.findMany.mock.calls[0][0].where;
    expect(where.class_date.gte.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(where.class_date.lte.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("compares inactive one-time classes against today's UTC midnight", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 10, 12, 0, 0));
      await getSessionsForRange(RANGE);
    } finally {
      vi.useRealTimers();
    }

    const where = mockTx.one_time_classes.findMany.mock.calls[0][0].where;
    const pastGate = where.OR.find(
      (clause: { class_date?: { lt: Date } }) => clause.class_date
    );
    expect(pastGate.class_date.lt.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("looks the attendance up by each occurrence's UTC-midnight session day", async () => {
    await getSessionsForRange(RANGE);

    const filters = mockTx.attendance.findMany.mock.calls[0][0].where.OR;
    // The single Monday occurrence of the 2026-09-07..13 week.
    expect(filters).toHaveLength(1);
    expect(filters[0].session_date.toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });

  it("places a one-time class on the day Postgres stores, not the day before", async () => {
    // Prisma hands a `date` column back as UTC midnight. Reading it with local
    // getters put a class stored for 26 oct on 25 oct in Ecuador (UTC-5).
    mockTx.scheduled_classes.findMany.mockResolvedValue([]);
    mockTx.one_time_classes.findMany.mockResolvedValue([
      {
        id: "33333333-4444-5555-8666-777777777777",
        branch_id: BRANCH,
        class_date: new Date("2026-09-10T00:00:00.000Z"),
        start_time: new Date("1970-01-01T10:00:00Z"),
        teacher_id: null,
        is_active: true,
        disciplines: { id: "d1", name: "Karate", code: "KA" },
      },
    ]);

    const result = await getSessionsForRange(RANGE);

    expect(result.data?.map((session) => session.session_date)).toEqual([
      "2026-09-10",
    ]);
  });

  it("still renders the occurrence on its calendar weekday", async () => {
    const result = await getSessionsForRange(RANGE);

    expect(result.success).toBe(true);
    expect(result.data?.map((session) => session.session_date)).toEqual([
      "2026-09-07",
    ]);
  });
});
