/**
 * Class Actions Branch Assertion Tests — Correction D.
 *
 * Proves that class mutations reject:
 * 1. A multi-branch caller using a branch they don't have assignment for
 * 2. Missing/invalid branch context
 *
 * Uses assertActiveBranchAssignment as extracted pure logic
 * (the actual server action wiring is tested via the assertion unit tests;
 * here we verify the integration contract).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertActiveBranchAssignment } from "@/lib/auth/assert-branch-assignment";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";
const BRANCH_C = "cccccccc-1111-2222-3333-444444444444";

describe("class action branch assertion contract", () => {
  it("rejects multi-branch caller passing a branch they lack assignment for", () => {
    const ctx = {
      userId: "multi-branch-admin",
      roles: ["admin" as const],
      assignments: [
        { role: "admin" as const, branchId: BRANCH_A },
        { role: "admin" as const, branchId: BRANCH_B },
      ],
    };

    // Caller has A and B, tries to use C
    const result = assertActiveBranchAssignment(ctx, BRANCH_C);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("permisos");
    }
  });

  it("accepts multi-branch caller passing their own assigned branch", () => {
    const ctx = {
      userId: "multi-branch-admin",
      roles: ["admin" as const],
      assignments: [
        { role: "admin" as const, branchId: BRANCH_A },
        { role: "admin" as const, branchId: BRANCH_B },
      ],
    };

    const result = assertActiveBranchAssignment(ctx, BRANCH_A);
    expect(result.ok).toBe(true);
  });

  it("rejects when branch_id is undefined (absent context)", () => {
    const ctx = {
      userId: "admin-1",
      roles: ["admin" as const],
      assignments: [{ role: "admin" as const, branchId: BRANCH_A }],
    };

    const result = assertActiveBranchAssignment(ctx, undefined);
    expect(result.ok).toBe(false);
  });

  it("rejects owner-only caller without admin/teacher assignment", () => {
    const ctx = {
      userId: "owner-1",
      roles: ["owner" as const],
      assignments: [{ role: "owner" as const, branchId: null }],
    };

    const result = assertActiveBranchAssignment(ctx, BRANCH_A);
    expect(result.ok).toBe(false);
  });

  it("rejects non-UUID branch_id", () => {
    const ctx = {
      userId: "admin-1",
      roles: ["admin" as const],
      assignments: [{ role: "admin" as const, branchId: BRANCH_A }],
    };

    const result = assertActiveBranchAssignment(ctx, "not-valid");
    expect(result.ok).toBe(false);
  });
});
