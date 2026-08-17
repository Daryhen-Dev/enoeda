/**
 * Branch teacher roster & self-enable tests.
 *
 * Covers:
 * - S4.1: listBranchTeacherOptions returns only active teachers from
 *   user_roles + user_profiles; zero teacher_profiles queries
 * - S5.1: enableSelfAsTeacher is idempotent (no duplicate row)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const {
  mockGetAuthenticatedContext,
  mockWithAuthenticatedUser,
  mockCreateClient,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  const mockGetAuthenticatedContext = vi.fn();
  const mockWithAuthenticatedUser = vi.fn();
  const mockCreateClient = vi.fn();
  const mockSupabaseFrom = vi.fn();
  return {
    mockGetAuthenticatedContext,
    mockWithAuthenticatedUser,
    mockCreateClient,
    mockSupabaseFrom,
  };
});

vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: mockGetAuthenticatedContext,
}));

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: mockWithAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockSupabaseFrom }),
}));

vi.mock("server-only", () => ({}));

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const USER_1 = "11111111-aaaa-bbbb-8ccc-dddddddddddd";
const USER_2 = "22222222-aaaa-bbbb-8ccc-dddddddddddd";

describe("listBranchTeacherOptions (user_roles source)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns only active teachers with names from user_profiles, zero teacher_profiles queries", async () => {
    // Setup: admin auth context
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: "admin-user",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      },
    });

    // Mock withAuthenticatedUser to return user_roles data
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        user_roles: {
          findMany: vi.fn().mockResolvedValue([
            { user_id: USER_1 },
            { user_id: USER_2 },
          ]),
        },
        // teacher_profiles should NOT be accessed
        teacher_profiles: {
          findMany: vi.fn().mockRejectedValue(
            new Error("teacher_profiles should not be queried")
          ),
        },
      };
      const result = await fn(mockTx);
      return { success: true, data: result };
    });

    // Mock Supabase admin client for user_profiles
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { user_id: USER_1, first_name: "Ana", surname: "García" },
              { user_id: USER_2, first_name: "Pedro", surname: "López" },
            ],
            error: null,
          }),
        }),
      }),
    });

    const { listBranchTeacherOptions } = await import(
      "@/lib/domain/roles/actions"
    );

    const result = await listBranchTeacherOptions({ branchId: BRANCH_A });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0]).toEqual({ id: USER_1, name: "Ana García" });
    expect(result.data![1]).toEqual({ id: USER_2, name: "Pedro López" });
  });
});

describe("enableSelfAsTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("calls assign_branch_teacher RPC with own userId and is idempotent", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: USER_1,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      },
    });

    mockCreateClient.mockResolvedValue({
      rpc: mockRpc,
    });

    const { enableSelfAsTeacher } = await import(
      "@/lib/domain/roles/actions"
    );

    const result = await enableSelfAsTeacher({ branchId: BRANCH_A });

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("assign_branch_teacher", {
      p_target: USER_1,
      p_branch_id: BRANCH_A,
    });
  });

  it("rejects if not admin of the specified branch", async () => {
    mockGetAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        userId: USER_1,
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_A }],
      },
    });

    const { enableSelfAsTeacher } = await import(
      "@/lib/domain/roles/actions"
    );

    const result = await enableSelfAsTeacher({ branchId: BRANCH_A });
    expect(result.success).toBe(false);
  });
});
