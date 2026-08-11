/**
 * Tests for lib/prisma/client.ts — withUser RLS context helper.
 *
 * These tests verify transaction-scoped RLS claims without a database. They
 * mock Prisma's adapter/client and Next's server-only marker.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaPgConstructor } = vi.hoisted(() => ({
  prismaPgConstructor: vi.fn(),
}));

interface TaggedRawCall {
  strings: readonly string[];
  values: readonly unknown[];
}

const executeRawCalls: TaggedRawCall[] = [];
let transactionCalls = 0;

vi.mock("server-only", () => ({}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class MockPrismaPg {
    constructor(options: { connectionString: string }) {
      prismaPgConstructor(options);
    }
  },
}));

vi.mock("@/lib/prisma/generated/client", () => ({
  PrismaClient: class MockPrismaClient {
    constructor() {}

    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      transactionCalls += 1;
      const tx = {
        $executeRaw: async (
          strings: TemplateStringsArray,
          ...values: readonly unknown[]
        ) => {
          executeRawCalls.push({ strings: [...strings], values });
        },
      };
      return fn(tx);
    }
  },
}));

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("withUser RLS context helper", () => {
  let withUser: typeof import("./client").withUser;

  beforeEach(async () => {
    executeRawCalls.length = 0;
    transactionCalls = 0;
    const mod = await import("./client");
    withUser = mod.withUser;
  });

  it("sets parameterized transaction claims and returns the callback result", async () => {
    const result = await withUser(
      { userId: VALID_USER_ID, roles: ["admin", "teacher"] },
      async () => "test-result"
    );

    expect(result).toBe("test-result");
    expect(executeRawCalls).toHaveLength(2);
    expect(executeRawCalls[0]).toEqual({
      strings: ["SET LOCAL ROLE authenticated"],
      values: [],
    });

    const setClaimsCall = executeRawCalls[1];
    const sqlText = setClaimsCall.strings.join("?");
    const serializedClaims = setClaimsCall.values[0];

    expect(sqlText).toBe("SELECT set_config('request.jwt.claims', ?, true);");
    expect(sqlText).not.toContain(VALID_USER_ID);
    expect(sqlText).not.toContain(String(serializedClaims));
    expect(JSON.parse(String(serializedClaims))).toEqual({
      sub: VALID_USER_ID,
      roles: ["admin", "teacher"],
    });
  });

  it("allows an empty roles array", async () => {
    await withUser({ userId: VALID_USER_ID, roles: [] }, async () => null);

    expect(JSON.parse(String(executeRawCalls[1].values[0]))).toEqual({
      sub: VALID_USER_ID,
      roles: [],
    });
  });

  it.each([
    [
      "invalid UUID",
      { userId: "not-a-uuid", roles: ["admin"] as const },
      "Invalid userId: expected a UUID.",
    ],
    [
      "non-array roles",
      { userId: VALID_USER_ID, roles: "admin" as unknown as readonly "admin"[] },
      "Invalid roles: expected an array.",
    ],
    [
      "disallowed role",
      { userId: VALID_USER_ID, roles: ["student"] as unknown as readonly "admin"[] },
      'Invalid roles: only "admin" and "teacher" are allowed.',
    ],
  ])("rejects %s before starting a transaction", async (_case, context, error) => {
    await expect(withUser(context, async () => "unreachable")).rejects.toThrow(error);

    expect(transactionCalls).toBe(0);
    expect(executeRawCalls).toHaveLength(0);
  });

  it("propagates errors from the callback", async () => {
    const error = new Error("test error");

    await expect(
      withUser({ userId: VALID_USER_ID, roles: ["admin"] }, async () => {
        throw error;
      })
    ).rejects.toThrow(error);
  });

  it("returns structured callback results through the transaction", async () => {
    const result = await withUser(
      { userId: VALID_USER_ID, roles: ["teacher"] },
      async () => ({ rows: 42 })
    );

    expect(result).toEqual({ rows: 42 });
  });
});

describe("Prisma singleton", () => {
  it("exports prisma client instance with $transaction", async () => {
    const { prisma } = await import("./client");

    expect(prisma).toBeDefined();
    expect(typeof prisma.$transaction).toBe("function");
    expect(prismaPgConstructor).toHaveBeenCalledWith({
      connectionString: "postgresql://test:test@localhost:5432/test",
    });
  });
});

describe("DATABASE_URL guard", () => {
  it("throws if DATABASE_URL is not set", async () => {
    vi.resetModules();

    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const globalPrisma = globalThis as unknown as {
      __prismaClient?: unknown;
    };
    delete globalPrisma.__prismaClient;

    vi.doMock("server-only", () => ({}));
    vi.doMock("@prisma/adapter-pg", () => ({
      PrismaPg: class MockPrismaPg {
        constructor() {}
      },
    }));
    vi.doMock("@/lib/prisma/generated/client", () => ({
      PrismaClient: class MockPrismaClient {
        constructor() {}
      },
    }));

    await expect(import("./client")).rejects.toThrow("DATABASE_URL is not set");

    process.env.DATABASE_URL = originalUrl;
  });
});
