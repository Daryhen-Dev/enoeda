/**
 * Branch Assignment Assertion Tests — Correction D.
 *
 * Validates the shared server-only assertion rejects:
 * - Absent/null branchId
 * - Non-UUID branchId
 * - Caller without active admin/teacher assignment for the branch
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertActiveBranchAssignment } from "./assert-branch-assignment";
import type { AuthenticatedContext } from "./server-context";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";

function makeCtx(assignments: Array<{ role: string; branchId: string | null }>): AuthenticatedContext {
  return {
    userId: "user-1",
    roles: assignments.map((a) => a.role) as AuthenticatedContext["roles"],
    assignments: assignments.map((a) => ({
      role: a.role as "admin" | "teacher" | "owner",
      branchId: a.branchId,
    })),
  };
}

describe("assertActiveBranchAssignment", () => {
  it("rejects undefined branchId", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, undefined);
    expect(result.ok).toBe(false);
  });

  it("rejects null branchId", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, null);
    expect(result.ok).toBe(false);
  });

  it("rejects empty string branchId", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, "");
    expect(result.ok).toBe(false);
  });

  it("rejects non-UUID branchId", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, "not-a-uuid");
    expect(result.ok).toBe(false);
  });

  it("rejects when caller has no assignment for the branch", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, BRANCH_B);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("permisos");
    }
  });

  it("rejects when caller has owner role but not admin/teacher for the branch", () => {
    const ctx = makeCtx([{ role: "owner", branchId: null }]);
    const result = assertActiveBranchAssignment(ctx, BRANCH_A);
    expect(result.ok).toBe(false);
  });

  it("accepts when caller has admin assignment for the branch", () => {
    const ctx = makeCtx([{ role: "admin", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, BRANCH_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.branchId).toBe(BRANCH_A);
    }
  });

  it("accepts when caller has teacher assignment for the branch", () => {
    const ctx = makeCtx([{ role: "teacher", branchId: BRANCH_A }]);
    const result = assertActiveBranchAssignment(ctx, BRANCH_A);
    expect(result.ok).toBe(true);
  });

  it("rejects when caller has admin in different branch (multi-branch caller)", () => {
    const ctx = makeCtx([
      { role: "admin", branchId: BRANCH_A },
      { role: "admin", branchId: BRANCH_B },
    ]);
    // This caller can access BRANCH_A and BRANCH_B but not a random branch
    const result = assertActiveBranchAssignment(ctx, "cccccccc-1111-2222-3333-444444444444");
    expect(result.ok).toBe(false);
  });

  it("accepts correct branch for multi-branch caller", () => {
    const ctx = makeCtx([
      { role: "admin", branchId: BRANCH_A },
      { role: "teacher", branchId: BRANCH_B },
    ]);
    const resultA = assertActiveBranchAssignment(ctx, BRANCH_A);
    const resultB = assertActiveBranchAssignment(ctx, BRANCH_B);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
  });
});
