/**
 * Server-only Prisma client with RLS context helper.
 *
 * Constructs a module-private Prisma singleton and exposes `withUser` for
 * setting Postgres session context (role + JWT claims) inside an
 * interactive transaction. This is the single allowed runtime Prisma
 * consumer in this codebase (also consumed internally by server-context.ts).
 *
 * NEVER import this module from middleware.ts or any Edge Runtime entrypoint.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/prisma/generated/client";

// --- Module-private Prisma singleton ---

/**
 * One Prisma client (and pg pool) per Node.js process, reused across requests.
 *
 * This is correct on the Node.js runtime (Vercel functions, `next start`).
 * It is NOT safe on Cloudflare Workers, which bind sockets to the request that
 * opened them; that runtime is no longer a deployment target.
 */
const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__prismaClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (server secret, never NEXT_PUBLIC)."
      );
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.__prismaClient = new PrismaClient({ adapter });
  }
  return globalForPrisma.__prismaClient;
}

// --- Types ---

/** Transaction client type extracted from Prisma's $transaction callback. */
export type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

const USER_ROLE_VALUES = ["admin", "teacher", "owner"] as const;
type UserRole = (typeof USER_ROLE_VALUES)[number];

interface UserContext {
  userId: string;
  roles: readonly UserRole[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUserContext({ userId, roles }: UserContext): void {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Invalid userId: expected a UUID.");
  }
  if (!Array.isArray(roles)) {
    throw new Error("Invalid roles: expected an array.");
  }
  if (!roles.every((role) => (USER_ROLE_VALUES as readonly string[]).includes(role))) {
    throw new Error('Invalid roles: only "admin", "teacher", and "owner" are allowed.');
  }
}

/**
 * Executes a callback inside an interactive transaction that sets the
 * Postgres session context for RLS evaluation:
 *
 * - `SET LOCAL ROLE authenticated` — assumes the RLS-bound role
 * - `SELECT set_config('request.jwt.claims', ..., true)` — provides auth.uid()
 *   and roles for the transaction only
 */
/**
 * Redacts credentials embedded in connection strings before they reach a log.
 * Postgres driver errors can echo the connection string back, which would put
 * the database password in Workers logs.
 */
function redactCredentials(value: string): string {
  return value.replace(/:\/\/([^:@/]+):[^:@/]*@/g, "://$1:****@");
}

/**
 * Reports the underlying failure of an RLS transaction.
 *
 * Callers map transaction errors to generic user-facing messages, so without
 * this the real cause never reaches the Workers logs and infrastructure
 * failures become undiagnosable.
 */
function reportTransactionFailure(error: unknown): void {
  if (error instanceof Error) {
    console.error("[prisma] withUser transaction failed", {
      name: error.name,
      message: redactCredentials(error.message),
      code: (error as { code?: unknown }).code,
      stack: error.stack ? redactCredentials(error.stack) : undefined,
    });
    return;
  }
  console.error("[prisma] withUser transaction failed", redactCredentials(String(error)));
}

export async function withUser<T>(
  ctx: UserContext,
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  validateUserContext(ctx);

  const { userId, roles } = ctx;
  const claims = JSON.stringify({ sub: userId, roles });
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true);`;
      return fn(tx);
    });
  } catch (error) {
    reportTransactionFailure(error);
    throw error;
  }
}
