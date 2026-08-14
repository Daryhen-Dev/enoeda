/**
 * Identity Resolver Tests — branch-scoped composite rows.
 *
 * Covers the acceptance scenarios for getAuthenticatedContext():
 * 1. Auth failure → unauthenticated
 * 2. RPC failure → no_roles
 * 3. Empty roles array → no_roles
 * 4. Valid composite row → success with ctx (roles + assignments)
 * 5. Unknown-role filtering → only recognized AppRoles kept
 * 6. Same Supabase client for auth.getUser() and rpc()
 * 7. Owner row with null branch_id → correctly parsed
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock Supabase client ---
const { mockCreateClient, mockGetUser, mockRpc, mockSupabase } = vi.hoisted(
  () => {
    const mockGetUser = vi.fn();
    const mockRpc = vi.fn();
    const mockSupabase = {
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    };

    return {
      mockCreateClient: vi.fn(),
      mockGetUser,
      mockRpc,
      mockSupabase,
    };
  }
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

// Mock server-only (no-op guard for Node runtime checks)
vi.mock("server-only", () => ({}));

describe("getAuthenticatedContext (identity-resolver)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("returns unauthenticated when auth.getUser fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "no session" },
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("returns no_roles when RPC errors", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "aaaa-bbbb-cccc-dddd" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: { message: "db error" } });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({ ok: false, reason: "no_roles" });
  });

  it("returns no_roles when roles array is empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "aaaa-bbbb-cccc-dddd" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({ ok: false, reason: "no_roles" });
  });

  it("returns authenticated context with composite admin row", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    const branchId = "aaaaaaaa-1111-2222-3333-444444444444";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ role: "admin", branch_id: branchId }],
      error: null,
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: {
        userId,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId }],
      },
    });
  });

  it("returns authenticated context with owner row (null branch_id)", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ role: "owner", branch_id: null }],
      error: null,
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: {
        userId,
        roles: ["owner"],
        assignments: [{ role: "owner", branchId: null }],
      },
    });
  });

  it("filters out unknown roles and keeps only recognized AppRoles", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [
        { role: "admin", branch_id: "aaaa-1111-2222-3333-444444444444" },
        { role: "unknown_role", branch_id: null },
        { role: "teacher", branch_id: "bbbb-1111-2222-3333-444444444444" },
      ],
      error: null,
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: {
        userId,
        roles: expect.arrayContaining(["admin", "teacher"]),
        assignments: [
          { role: "admin", branchId: "aaaa-1111-2222-3333-444444444444" },
          { role: "teacher", branchId: "bbbb-1111-2222-3333-444444444444" },
        ],
      },
    });
  });

  it("uses same Supabase client for both getUser and rpc calls", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ role: "teacher", branch_id: "aaaa-bbbb-cccc-dddd" }],
      error: null,
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    await getAuthenticatedContext();

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("current_roles");
  });
});
