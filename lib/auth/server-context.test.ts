/**
 * U3-A2 Private RLS Executor Tests.
 *
 * Proves that:
 * 1. getAuthenticatedContext() delegates to the identity-resolver (no direct Supabase)
 * 2. Unauthenticated and no_roles outcomes are preserved through the adapter
 * 3. withAuthenticatedUser sets RLS claims via the module-private withUser
 * 4. Raw PostgreSQL errors are NOT exposed to callers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the identity resolver (the trusted upstream) ---
const mockResolveIdentity = vi.fn();

vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: (...args: unknown[]) => mockResolveIdentity(...args),
}));

// Mock server-only (no-op guard for Node runtime checks)
vi.mock("server-only", () => ({}));

// Mock the Prisma adapter and generated client — server-context constructs
// the singleton internally, so we mock the dependencies it uses.
const mockTransaction = vi.fn();
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class MockPrismaPg {
    constructor() {}
  },
}));
vi.mock("@/lib/prisma/generated/client", () => ({
  PrismaClient: class MockPrismaClient {
    constructor() {}
    $transaction(...args: unknown[]) {
      return mockTransaction(...args);
    }
  },
}));

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

describe("getAuthenticatedContext (RLS executor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the identity resolver — no direct Supabase calls", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: { userId, roles: ["admin"] },
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();

    expect(mockResolveIdentity).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      ctx: { userId, roles: ["admin"] },
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

  it("preserves multi-role context from resolver", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: { userId, roles: ["admin", "teacher"] },
    });

    const { getAuthenticatedContext } = await import(
      "@/lib/auth/server-context"
    );
    const result = await getAuthenticatedContext();
    expect(result).toEqual({
      ok: true,
      ctx: { userId, roles: ["admin", "teacher"] },
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
      error: "Authentication required",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
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
      error: "Insufficient permissions",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("sets RLS claims with resolver-derived context inside the transaction", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: { userId, roles: ["admin"] },
    });

    const executeRawCalls: Array<{ strings: string[]; values: unknown[] }> = [];
    mockTransaction.mockImplementation(
      async (txFn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          $executeRaw: async (
            strings: TemplateStringsArray,
            ...values: unknown[]
          ) => {
            executeRawCalls.push({ strings: [...strings], values });
          },
        };
        return txFn(mockTx);
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
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(executeRawCalls[0]).toEqual({
      strings: ["SET LOCAL ROLE authenticated"],
      values: [],
    });

    const claimsCall = executeRawCalls[1];
    expect(claimsCall.strings.join("?")).toBe(
      "SELECT set_config('request.jwt.claims', ?, true);"
    );
    expect(JSON.parse(String(claimsCall.values[0]))).toEqual({
      sub: userId,
      roles: ["admin"],
    });
    expect(result).toEqual({
      success: true,
      data: { id: "test", receivedCtx: { userId, roles: ["admin"] } },
    });
  });

  it("does not expose raw PostgreSQL errors to callers", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    mockResolveIdentity.mockResolvedValue({
      ok: true,
      ctx: { userId, roles: ["admin"] },
    });

    mockTransaction.mockImplementation(async () => {
      throw new Error("relation \"public.branches\" does not exist");
    });

    const { withAuthenticatedUser } = await import(
      "@/lib/auth/server-context"
    );
    const result = await withAuthenticatedUser(async () => ({ id: "x" }));
    expect(result).toEqual({
      success: false,
      error: "An unexpected error occurred",
    });
  });
});
