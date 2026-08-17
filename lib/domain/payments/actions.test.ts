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
  listOverdueStudents: vi.fn().mockResolvedValue([]),
}));

import { getOverdueStudentCount, getOverdueStudents } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";

describe("getOverdueStudentCount branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId is empty string", async () => {
    const result = await getOverdueStudentCount("");
    expect(result.success).toBe(false);
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
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
    const result = await getOverdueStudents("");
    expect(result.success).toBe(false);
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_B }],
      };
      const tx = {};
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getOverdueStudents(BRANCH_A);
    expect(result.success).toBe(false);
  });
});
