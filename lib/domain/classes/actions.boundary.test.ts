/**
 * Classes action boundary tests — getSessionsForRange branch validation.
 *
 * Validates that getSessionsForRange validates caller active branch assignment
 * internally before reading.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuthenticatedUser = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

vi.mock("@/lib/auth/assert-branch-assignment", async () => {
  const actual = await vi.importActual("@/lib/auth/assert-branch-assignment");
  return actual;
});

import { getSessionsForRange } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";

describe("getSessionsForRange branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when caller has no active assignment for the branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: "user-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_B }],
      };
      const tx = {
        scheduled_classes: { findMany: vi.fn() },
        one_time_classes: { findMany: vi.fn() },
        class_sessions: { findMany: vi.fn() },
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getSessionsForRange({
      branch_id: BRANCH_A,
      start_date: "2024-06-01",
      end_date: "2024-06-30",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when branch_id is empty string", async () => {
    const result = await getSessionsForRange({
      branch_id: "",
      start_date: "2024-06-01",
      end_date: "2024-06-30",
    });

    expect(result.success).toBe(false);
  });
});
