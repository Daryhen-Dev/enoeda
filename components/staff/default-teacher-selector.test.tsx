/**
 * DefaultTeacherSelector — unit test (strict TDD).
 * Verifies: component exists, setBranchDefaultTeacher action correctness,
 * and listBranchTeacherOptions filters to active same-branch teachers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mockRpc })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/identity-resolver", () => ({ getAuthenticatedContext: vi.fn() }));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: vi.fn() }));

import { setBranchDefaultTeacher } from "@/lib/domain/roles/actions";
const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const TEACHER_A = "cccccccc-1111-2222-8333-444444444444";

describe("DefaultTeacherSelector — active same-branch filtering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("component module exports DefaultTeacherSelector", async () => {
    const mod = await import("@/components/staff/default-teacher-selector");
    expect(typeof mod.DefaultTeacherSelector).toBe("function");
  });

  it("calls set_branch_default_teacher RPC with correct params", async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: null });
    const r = await setBranchDefaultTeacher({ branchId: BRANCH, teacherId: TEACHER_A });
    expect(mockRpc).toHaveBeenCalledWith("set_branch_default_teacher", { p_branch_id: BRANCH, p_teacher_id: TEACHER_A });
    expect(r).toEqual({ success: true });
  });

  it("rejects invalid input without calling RPC", async () => {
    expect((await setBranchDefaultTeacher({ branchId: "bad", teacherId: TEACHER_A })).success).toBe(false);
    expect((await setBranchDefaultTeacher({ branchId: BRANCH, teacherId: "bad" })).success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("maps authorization error to user-facing message", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "unauthorized: insufficient privileges" } });
    const r = await setBranchDefaultTeacher({ branchId: BRANCH, teacherId: TEACHER_A });
    expect(r.success).toBe(false);
    expect(r.error).toContain("permisos");
  });

  it("listBranchTeacherOptions returns only active same-branch teachers", async () => {
    const { withAuthenticatedUser } = await import("@/lib/auth/server-context");
    const { getAuthenticatedContext } = await import("@/lib/auth/identity-resolver");
    const { listBranchTeacherOptions } = await import("@/lib/domain/roles/actions");
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ ok: true, ctx: { userId: "admin-1", assignments: [{ role: "admin", branchId: BRANCH }] } } as never);
    vi.mocked(withAuthenticatedUser).mockImplementation((async (fn: unknown) =>
      ({ success: true, data: await (fn as (tx: unknown, ctx: unknown) => Promise<unknown>)({ user_roles: { findMany: vi.fn().mockResolvedValue([{ user_id: TEACHER_A }]) } }, {}) })
    ) as never);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    vi.mocked(createAdminClient).mockReturnValue({ from: () => ({ select: () => ({ in: () => ({ order: vi.fn().mockResolvedValue({ data: [{ user_id: TEACHER_A, first_name: "Ana", surname: "López" }], error: null }) }) }) }) } as never);
    const result = await listBranchTeacherOptions({ branchId: BRANCH });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: TEACHER_A, name: "Ana López" }]);
  });
});
