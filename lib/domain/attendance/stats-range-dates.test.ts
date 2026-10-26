/**
 * getAttendanceStats bounds its `session_date` range with UTC-midnight
 * instants (T6 of odd/tasks/date-only-writes.md).
 *
 * `session_date` is a Postgres `date` column, so the range bounds must be the
 * UTC midnight of their calendar days. Local midnight
 * (`new Date(day + "T00:00:00")`) compares against the wrong instant on any
 * server east of UTC and can drop or add a boundary day. The assertions pin
 * exact instants so they fail on any machine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

import { getAttendanceStats } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";

function setup() {
  const count = vi.fn().mockResolvedValue(0);
  const tx = {
    students: {
      findUnique: vi.fn().mockResolvedValue({ branch_id: BRANCH_A }),
    },
    attendance: { count },
  };
  mockWithAuth.mockImplementation(
    async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => ({
      success: true,
      data: await fn(tx, {
        userId: "u1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      }),
    })
  );
  return { count };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAttendanceStats date range", () => {
  it("bounds the range with the UTC midnight of both calendar days", async () => {
    const { count } = setup();

    const result = await getAttendanceStats({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
      from: "2026-10-01",
      to: "2026-10-31",
    });

    expect(result.success).toBe(true);
    const where = count.mock.calls[0][0].where as {
      session_date: { gte: Date; lte: Date };
    };
    expect(where.session_date.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(where.session_date.lte.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("applies the same bounds to the attended count", async () => {
    const { count } = setup();

    await getAttendanceStats({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
      from: "2026-10-01",
      to: "2026-10-31",
    });

    const presentWhere = count.mock.calls[1][0].where as {
      session_date: { gte: Date; lte: Date };
      attended: boolean;
    };
    expect(presentWhere.attended).toBe(true);
    expect(presentWhere.session_date.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(presentWhere.session_date.lte.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("sends no date filter when no range is given", async () => {
    const { count } = setup();

    await getAttendanceStats({ student_id: STUDENT_ID, branch_id: BRANCH_A });

    expect(count.mock.calls[0][0].where).not.toHaveProperty("session_date");
  });
});
