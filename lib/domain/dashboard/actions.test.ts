/**
 * Dashboard KPI tests — branch-scoped queries.
 *
 * Validates that getDashboardKpis requires a branchId and scopes
 * all queries to that single branch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWithAuthenticatedUser = vi.fn();
const mockCountOverdueStudents = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    mockWithAuthenticatedUser(...args),
}));

vi.mock("@/lib/domain/payments/queries", () => ({
  countOverdueStudents: (...args: unknown[]) =>
    mockCountOverdueStudents(...args),
}));

import { getDashboardKpis } from "./actions";

const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("getDashboardKpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires branchId parameter", async () => {
    // Calling without branchId should fail
    const result = await getDashboardKpis();
    expect(result.success).toBe(false);
  });

  it("passes branchId filter to student count queries", async () => {
    const mockTx = {
      branches: {
        findUnique: vi.fn().mockResolvedValue({ id: BRANCH_ID, name: "Main Branch" }),
      },
      students: {
        count: vi.fn().mockResolvedValue(5),
      },
    };
    mockCountOverdueStudents.mockResolvedValue(1);

    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const data = await fn(mockTx);
      return { success: true, data };
    });

    const result = await getDashboardKpis(BRANCH_ID);

    expect(result.success).toBe(true);
    // Student count queries must include branch_id filter
    const countCalls = mockTx.students.count.mock.calls;
    expect(countCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of countCalls) {
      expect(call[0].where).toHaveProperty("branch_id", BRANCH_ID);
    }
  });

  it("passes branchId to countOverdueStudents", async () => {
    const mockTx = {
      branches: {
        findUnique: vi.fn().mockResolvedValue({ id: BRANCH_ID, name: "Main Branch" }),
      },
      students: {
        count: vi.fn().mockResolvedValue(3),
      },
    };
    mockCountOverdueStudents.mockResolvedValue(2);

    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const data = await fn(mockTx);
      return { success: true, data };
    });

    const result = await getDashboardKpis(BRANCH_ID);

    expect(result.success).toBe(true);
    expect(mockCountOverdueStudents).toHaveBeenCalledWith(mockTx, BRANCH_ID);
  });

  it("returns branch-scoped KPI data structure", async () => {
    const mockTx = {
      branches: {
        findUnique: vi.fn().mockResolvedValue({ id: BRANCH_ID, name: "Main Branch" }),
      },
      students: {
        count: vi.fn()
          .mockResolvedValueOnce(10) // active
          .mockResolvedValueOnce(3),  // inactive
      },
    };
    mockCountOverdueStudents.mockResolvedValue(2);

    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const data = await fn(mockTx);
      return { success: true, data };
    });

    const result = await getDashboardKpis(BRANCH_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        branch_name: "Main Branch",
        active_student_count: 10,
        inactive_student_count: 3,
        overdue_student_count: 2,
      });
    }
  });
});
