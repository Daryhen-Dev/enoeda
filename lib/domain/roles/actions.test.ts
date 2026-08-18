/**
 * revokeBranchTeacher — unit tests (mock Supabase RPC).
 * Verifies: schema validation, RPC call shape, result typing, error mapping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mockRpc })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/identity-resolver", () => ({ getAuthenticatedContext: vi.fn() }));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: vi.fn() }));

import { revokeBranchTeacher } from "./actions";

const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const TARGET = "bbbbbbbb-1111-2222-8333-444444444444";

describe("revokeBranchTeacher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid input without calling RPC", async () => {
    expect((await revokeBranchTeacher({ targetUserId: "bad", branchId: BRANCH })).success).toBe(false);
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: "bad" })).success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls revoke_teacher_with_reassignment RPC and returns typed result", async () => {
    mockRpc.mockResolvedValue({ data: { status: "revoked", reassignedClassCount: 3, cutoff: "2026-08-28T10:00:00Z" }, error: null });
    const r = await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH });
    expect(mockRpc).toHaveBeenCalledWith("revoke_teacher_with_reassignment", { p_target_user_id: TARGET, p_branch_id: BRANCH });
    expect(r).toEqual({ success: true, data: { status: "revoked", reassignedClassCount: 3, cutoff: "2026-08-28T10:00:00Z" } });
  });

  it("returns blocked result variants", async () => {
    mockRpc.mockResolvedValue({ data: { status: "blocked", reason: "no_default_teacher" }, error: null });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).data).toEqual({ status: "blocked", reason: "no_default_teacher" });

    const conflicts = [{ classId: "c1", dayOfWeek: 1, startTime: "08:00:00" }];
    mockRpc.mockResolvedValue({ data: { status: "blocked", reason: "conflict", conflicts }, error: null });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).data).toEqual({ status: "blocked", reason: "conflict", conflicts });
  });

  it("maps RPC errors to user-facing messages", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "unauthorized: insufficient privileges" } });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).success).toBe(false);
    mockRpc.mockResolvedValue({ data: null, error: { message: "some_pg_error" } });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).success).toBe(false);
  });
});
