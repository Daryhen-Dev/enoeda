/**
 * Branch Context Resolver Tests — page-level branch validation.
 *
 * Covers spec scenarios:
 * - S1.3: 0 branches → error
 * - S1.1: 1 branch, param matches → valid
 * - S1.1: 1 branch, param differs → redirect
 * - S1.2: N>1, param matches one → valid
 * - S1.2: N>1, no match → selector
 * - Dedup: admin+teacher same branchId counted once
 * - Unauthenticated/no roles → error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock identity resolver ---
const { mockGetAuthenticatedContext } = vi.hoisted(() => ({
  mockGetAuthenticatedContext: vi.fn(),
}));

const { mockWithAuthenticatedUser } = vi.hoisted(() => ({
  mockWithAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: mockGetAuthenticatedContext,
}));

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: mockWithAuthenticatedUser,
}));

vi.mock("server-only", () => ({}));

import { resolveBranchContext } from "@/lib/auth/branch-context";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";
const BRANCH_C = "cccccccc-1111-2222-3333-444444444444";

describe("resolveBranchContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: branch name resolution returns names based on IDs
    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => ({
      success: true,
      data: [],
    }));
  });

  it("returns error when unauthenticated", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    const result = await resolveBranchContext(undefined);
    expect(result).toEqual({ type: "error" });
  });

  it("returns error when no roles", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: false,
      reason: "no_roles",
    });

    const result = await resolveBranchContext(undefined);
    expect(result).toEqual({ type: "error" });
  });

  it("returns error when 0 branch assignments (owner-only, no branch)", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["owner"],
        assignments: [{ role: "owner", branchId: null }],
      },
    });

    const result = await resolveBranchContext(undefined);
    expect(result).toEqual({ type: "error" });
  });

  it("returns valid when single branch matches param", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      },
    });

    const result = await resolveBranchContext(BRANCH_A);
    expect(result).toEqual({
      type: "valid",
      branchId: BRANCH_A,
      canManage: true,
    });
  });

  it("returns redirect when single branch but param differs", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      },
    });

    const result = await resolveBranchContext(BRANCH_B);
    expect(result).toEqual({ type: "redirect", branchId: BRANCH_A });
  });

  it("returns redirect when single branch and no param", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_A }],
      },
    });

    const result = await resolveBranchContext(undefined);
    expect(result).toEqual({ type: "redirect", branchId: BRANCH_A });
  });

  it("returns valid when N>1 branches and param matches", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "admin", branchId: BRANCH_B },
        ],
      },
    });

    const result = await resolveBranchContext(BRANCH_B);
    expect(result).toEqual({
      type: "valid",
      branchId: BRANCH_B,
      canManage: true,
    });
  });

  it("returns selector when N>1 branches and param does not match", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "admin", branchId: BRANCH_B },
        ],
      },
    });

    mockWithAuthenticatedUser.mockResolvedValue({
      success: true,
      data: [
        { id: BRANCH_A, name: "Sucursal A" },
        { id: BRANCH_B, name: "Sucursal B" },
      ],
    });

    const result = await resolveBranchContext(BRANCH_C);
    expect(result.type).toBe("selector");
    if (result.type === "selector") {
      expect(result.branches).toHaveLength(2);
      expect(result.branches.map((b) => b.id)).toContain(BRANCH_A);
      expect(result.branches.map((b) => b.id)).toContain(BRANCH_B);
      // Names must be actual names, not UUIDs
      expect(result.branches.map((b) => b.name)).toContain("Sucursal A");
      expect(result.branches.map((b) => b.name)).toContain("Sucursal B");
    }
  });

  it("returns selector when N>1 branches and no param", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "admin", branchId: BRANCH_B },
        ],
      },
    });

    mockWithAuthenticatedUser.mockResolvedValue({
      success: true,
      data: [
        { id: BRANCH_A, name: "Centro" },
        { id: BRANCH_B, name: "Norte" },
      ],
    });

    const result = await resolveBranchContext(undefined);
    expect(result.type).toBe("selector");
  });

  it("deduplicates admin+teacher same branchId into one branch", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin", "teacher"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "teacher", branchId: BRANCH_A },
        ],
      },
    });

    // Single unique branch → redirect behavior (only 1 branch after dedup)
    const result = await resolveBranchContext(undefined);
    expect(result).toEqual({ type: "redirect", branchId: BRANCH_A });
  });

  it("canManage is true when admin assignment exists for the branch", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin", "teacher"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "teacher", branchId: BRANCH_B },
        ],
      },
    });

    const result = await resolveBranchContext(BRANCH_A);
    expect(result).toEqual({
      type: "valid",
      branchId: BRANCH_A,
      canManage: true,
    });
  });

  it("canManage is false when only teacher assignment exists for the branch", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "user-1",
        roles: ["admin", "teacher"],
        assignments: [
          { role: "admin", branchId: BRANCH_A },
          { role: "teacher", branchId: BRANCH_B },
        ],
      },
    });

    const result = await resolveBranchContext(BRANCH_B);
    expect(result).toEqual({
      type: "valid",
      branchId: BRANCH_B,
      canManage: false,
    });
  });
});
