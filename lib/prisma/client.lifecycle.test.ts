/**
 * Connection lifecycle of `withUser`.
 *
 * Cloudflare Workers bind TCP sockets to the request that opened them, so a
 * Prisma client (and its pg pool) must never be shared across requests. Each
 * `withUser` call owns a fresh client and disconnects it when done.
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
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    transactionImpl = (fn) => fn(fakeTx);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("creates a new client per call and never reuses one across calls", async () => {
    const { withUser } = await import("./client");

    await withUser(CTX, async () => "a");
    await withUser(CTX, async () => "b");

    expect(instances).toHaveLength(2);
    expect(instances[0]).not.toBe(instances[1]);
  });

  it("disconnects the client after a successful transaction", async () => {
    const { withUser } = await import("./client");

    await expect(withUser(CTX, async () => 42)).resolves.toBe(42);
    expect(instances[0].$disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects the client when the transaction fails", async () => {
    const { withUser } = await import("./client");
    transactionImpl = async () => {
      throw new Error("boom");
    };

    await expect(withUser(CTX, async () => 1)).rejects.toThrow("boom");
    expect(instances[0].$disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not mask the original error when disconnect fails", async () => {
    const { withUser } = await import("./client");
    transactionImpl = async () => {
      throw new Error("original");
    };

    const pending = withUser(CTX, async () => 1);
    instances[0].$disconnect.mockRejectedValueOnce(new Error("disconnect"));

    await expect(pending).rejects.toThrow("original");
  });
});
