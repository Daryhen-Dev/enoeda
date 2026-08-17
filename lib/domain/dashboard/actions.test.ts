/**
 * Dashboard action boundary tests — branch context validation.
 *
 * Validates that getDashboardKpis validates caller branch assignment internally.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuthenticatedUser = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

vi.mock("@/lib/domain/payments/queries", () => ({
  countOverdueStudents: vi.fn().mockResolvedValue(0),
}));

import { getDashboardKpis } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";

describe("getDashboardKpis branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId is undefined", async () => {
    const result = await getDashboardKpis(undefined);
    expect(result.success).toBe(false);
    // Should not even call withAuthenticatedUser for no-branch
  });

  it("rejects when branchId is empty string", async () => {
    const result = await getDashboardKpis("");
    expect(result.success).toBe(false);
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_B }],
      };
      const tx = {
        branches: { findUnique: vi.fn() },
        students: { count: vi.fn() },
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getDashboardKpis(BRANCH_A);

    expect(result.success).toBe(false);
    // The branch.findUnique should NOT have been called (fail before read)
  });
});
