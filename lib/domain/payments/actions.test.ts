/**
 * Payment read action boundary tests — branch context validation.
 *
 * Validates that getOverdueStudentCount and getOverdueStudents validate
 * caller branch assignment internally.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuthenticatedUser = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

vi.mock("@/lib/domain/payments/queries", () => ({
  countOverdueStudents: vi.fn().mockResolvedValue(0),
  getMonthlyPaymentSummaryQuery: vi.fn(),
  listOverdueStudents: vi.fn().mockResolvedValue([]),
}));

import {
  getMonthlyPaymentSummary,
  getOverdueStudentCount,
  getOverdueStudents,
} from "./actions";
import {
  getMonthlyPaymentSummaryQuery,
  listOverdueStudents,
} from "./queries";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-4222-a333-444444444444";

describe("getOverdueStudentCount branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId is empty string", async () => {
    const result = await getOverdueStudentCount("");
    expect(result.success).toBe(false);
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_B }],
      };
      const tx = {};
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getOverdueStudentCount(BRANCH_A);
    expect(result.success).toBe(false);
  });
});

describe("getOverdueStudents branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId is empty string", async () => {
    const result = await getOverdueStudents({ branch_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid optional discipline UUID before authentication or querying", async () => {
    const result = await getOverdueStudents({
      branch_id: BRANCH_A,
      discipline_id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
    expect(listOverdueStudents).not.toHaveBeenCalled();
  });

  it("scopes an assigned caller's query to the supplied discipline UUID", async () => {
    const disciplineId = "cccccccc-1111-4222-a333-444444444444";
    mockWithAuthenticatedUser.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
        const data = await fn(
          {},
          {
            userId: "user-1",
            roles: ["teacher"],
            assignments: [{ role: "teacher", branchId: BRANCH_A }],
          }
        );
        return { success: true, data };
      }
    );

    const result = await getOverdueStudents({
      branch_id: BRANCH_A,
      discipline_id: disciplineId,
    });

    expect(result).toEqual({ success: true, data: [] });
    expect(listOverdueStudents).toHaveBeenCalledWith({}, BRANCH_A, disciplineId);
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: "user-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_B }],
      };
      const tx = {};
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getOverdueStudents({ branch_id: BRANCH_A });
    expect(result.success).toBe(false);
  });
});

describe("getMonthlyPaymentSummary branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed console filter input before authentication", async () => {
    const result = await getMonthlyPaymentSummary({
      branch_id: BRANCH_A,
      discipline_id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects an empty branch", async () => {
    const result = await getMonthlyPaymentSummary({
      branch_id: "",
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects a caller without an assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
        const data = await fn(
          {},
          {
            userId: "user-1",
            roles: ["admin"],
            assignments: [{ role: "admin", branchId: BRANCH_B }],
          }
        );
        return { success: true, data };
      }
    );

    const result = await getMonthlyPaymentSummary({ branch_id: BRANCH_A });

    expect(result.success).toBe(false);
  });

  it("returns zero metrics and no activity for a valid discipline without enrollments", async () => {
    const disciplineId = "cccccccc-1111-4222-a333-444444444444";
    const summary = {
      totalMoneyCollected: 0,
      monthlyPaymentCount: 0,
      classPaymentCount: 0,
      overdueStudentCount: 0,
      recentActivity: [],
    };
    vi.mocked(getMonthlyPaymentSummaryQuery).mockResolvedValue(summary);
    mockWithAuthenticatedUser.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
        const data = await fn(
          {},
          {
            userId: "user-1",
            roles: ["admin"],
            assignments: [{ role: "admin", branchId: BRANCH_A }],
          }
        );
        return { success: true, data };
      }
    );

    const result = await getMonthlyPaymentSummary({
      branch_id: BRANCH_A,
      discipline_id: disciplineId,
    });

    expect(result).toEqual({ success: true, data: summary });
    expect(getMonthlyPaymentSummaryQuery).toHaveBeenCalledWith({}, BRANCH_A, disciplineId);
  });
});
