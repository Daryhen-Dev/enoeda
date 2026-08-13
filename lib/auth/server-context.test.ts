/**
 * Private RLS Executor Tests (branch-scoped).
 *
 * Proves that:
 * 1. getAuthenticatedContext() delegates to the identity-resolver (no direct Supabase)
 * 2. Unauthenticated and no_roles outcomes are preserved through the adapter
 * 3. withAuthenticatedUser sets RLS claims via the module-private withUser
 * 4. Raw PostgreSQL errors are NOT exposed to callers
 * 5. AuthenticatedContext carries assignments alongside roles
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the identity resolver (the trusted upstream) ---
const mockResolveIdentity = vi.fn();

vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: (...args: unknown[]) => mockResolveIdentity(...args),
}));

// Mock server-only (no-op guard for Node runtime checks)
vi.mock("server-only", () => ({}));

// Mock the prisma/client module which provides withUser and TransactionClient
const mockWithUser = vi.fn();
vi.mock("@/lib/prisma/client", () => ({
  withUser: (...args: unknown[]) => mockWithUser(...args),
}));

describe("getAuthenticatedContext (RLS executor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the identity resolver — no direct Supabase calls", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: {
        userId,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: "branch-1" }],
      },
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();

    expect(mockResolveIdentity).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      ctx: {
        userId,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: "branch-1" }],
      },
    });
  });

  it("returns unauthenticated when resolver reports unauthenticated", async () => {
    mockResolveIdentity.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("returns no_roles when resolver reports no_roles", async () => {
    mockResolveIdentity.mockResolvedValue({
      ok: false,
      reason: "no_roles",
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({ ok: false, reason: "no_roles" });
  });

  it("preserves multi-role context with assignments from resolver", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: {
        userId,
        roles: ["admin", "teacher"],
        assignments: [
          { role: "admin", branchId: "branch-1" },
          { role: "teacher", branchId: "branch-2" },
        ],
      },
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: {
        userId,
        roles: ["admin", "teacher"],
        assignments: [
          { role: "admin", branchId: "branch-1" },
          { role: "teacher", branchId: "branch-2" },
        ],
      },
    });
  });
});

describe("withAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when resolver reports unauthenticated", async () => {
    mockResolveIdentity.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    const { withAuthenticatedUser } = await import(
      "@/lib/auth/server-context"
    );
    const result = await withAuthenticatedUser(async () => ({ id: "x" }));
    expect(result).toEqual({
      success: false,
      error: "Debe iniciar sesión para continuar.",
    });
    expect(mockWithUser).not.toHaveBeenCalled();
  });

  it("returns permission error when resolver reports no_roles", async () => {
    mockResolveIdentity.mockResolvedValue({
      ok: false,
      reason: "no_roles",
    });

    const { withAuthenticatedUser } = await import(
      "@/lib/auth/server-context"
    );
    const result = await withAuthenticatedUser(async () => ({ id: "x" }));
    expect(result).toEqual({
      success: false,
      error: "No tiene permisos para realizar esta acción.",
    });
    expect(mockWithUser).not.toHaveBeenCalled();
  });

  it("delegates to withUser with resolver-derived context", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: {
        userId,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: "branch-1" }],
      },
    });

    mockWithUser.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = { $queryRaw: vi.fn() };
        return fn(mockTx);
      }
    );

    const { withAuthenticatedUser } = await import(
      "@/lib/auth/server-context"
    );
    const result = await withAuthenticatedUser(async (_tx, ctx) => ({
      id: "test",
      receivedCtx: ctx,
    }));

    expect(mockResolveIdentity).toHaveBeenCalledTimes(1);
    expect(mockWithUser).toHaveBeenCalledTimes(1);
    expect(mockWithUser).toHaveBeenCalledWith(
      { userId, roles: ["admin"] },
      expect.any(Function)
    );
    expect(result).toEqual({
      success: true,
      data: {
        id: "test",
        receivedCtx: {
          userId,
          roles: ["admin"],
          assignments: [{ role: "admin", branchId: "branch-1" }],
        },
      },
    });
  });

  it("does not expose raw PostgreSQL errors to callers", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: {
        userId,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: "branch-1" }],
      },
    });

    mockWithUser.mockImplementation(async () => {
      throw new Error("relation \"public.branches\" does not exist");
    });

    const { withAuthenticatedUser } = await import(
      "@/lib/auth/server-context"
    );
    const result = await withAuthenticatedUser(async () => ({ id: "x" }));
    expect(result).toEqual({
      success: false,
      error: "Ocurrió un error inesperado.",
    });
  });
});
