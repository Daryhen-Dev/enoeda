/**
 * Connection lifecycle of `withUser` on the Node.js runtime.
 *
 * One Prisma client (and its pg pool) is created lazily per process and
 * reused across calls; it is never disconnected per call, which would throw
 * away the pool on every request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const instances: Array<{ $disconnect: ReturnType<typeof vi.fn> }> = [];
let transactionImpl: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(function PrismaPg() {}),
}));

vi.mock("@/lib/prisma/generated/client", () => ({
  PrismaClient: vi.fn(function PrismaClient(this: Record<string, unknown>) {
    this.$disconnect = vi.fn(async () => {});
    this.$transaction = (fn: (tx: unknown) => Promise<unknown>) => transactionImpl(fn);
    instances.push(this as { $disconnect: ReturnType<typeof vi.fn> });
  }),
}));

const CTX = {
  userId: "550e8400-e29b-41d4-a716-446655440000",
  roles: ["owner"] as const,
};

const fakeTx = { $executeRaw: vi.fn(async () => 0) };

describe("withUser connection lifecycle", () => {
  beforeEach(() => {
    instances.length = 0;
    delete (globalThis as { __prismaClient?: unknown }).__prismaClient;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    transactionImpl = (fn) => fn(fakeTx);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reuses one client across calls", async () => {
    const { withUser } = await import("./client");

    await withUser(CTX, async () => "a");
    await withUser(CTX, async () => "b");

    expect(instances).toHaveLength(1);
  });

  it("does not disconnect the shared client after a call", async () => {
    const { withUser } = await import("./client");

    await expect(withUser(CTX, async () => 42)).resolves.toBe(42);
    expect(instances[0].$disconnect).not.toHaveBeenCalled();
  });

  it("rethrows transaction failures and keeps the client usable", async () => {
    const { withUser } = await import("./client");
    transactionImpl = async () => {
      throw new Error("boom");
    };

    await expect(withUser(CTX, async () => 1)).rejects.toThrow("boom");

    transactionImpl = (fn) => fn(fakeTx);
    await expect(withUser(CTX, async () => 2)).resolves.toBe(2);
    expect(instances).toHaveLength(1);
  });

  it("fails clearly when DATABASE_URL is missing", async () => {
    const { withUser } = await import("./client");
    delete process.env.DATABASE_URL;

    await expect(withUser(CTX, async () => 1)).rejects.toThrow(
      "DATABASE_URL is not set"
    );
  });
});
