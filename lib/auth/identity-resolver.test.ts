/**
 * Issue #14 — U3-A1 Identity Resolver Tests.
 *
 * Covers the acceptance scenarios for getAuthenticatedContext():
 * 1. Auth failure → unauthenticated
 * 2. RPC failure → no_roles
 * 3. Empty roles array → no_roles
 * 4. Valid role → success with ctx
 * 5. Unknown-role filtering → only recognized AppRoles kept
 * 6. Same Supabase client for auth.getUser() and rpc()
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

  it("returns authenticated context with valid role", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: ["admin"], error: null });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: { userId, roles: ["admin"] },
    });
  });

  it("filters out unknown roles and keeps only recognized AppRoles", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: ["admin", "unknown_role", "teacher", 42],
      error: null,
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: { userId, roles: ["admin", "teacher"] },
    });
  });

  it("uses same Supabase client for both getUser and rpc calls", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: ["teacher"], error: null });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/identity-resolver"
    );
    await getAuthenticatedContext();

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("current_roles");
  });
});
