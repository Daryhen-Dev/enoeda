/**
 * Server-only Prisma Client singleton with RLS-aware transaction helper.
 *
 * NEVER import this module from middleware.ts or any Edge Runtime entrypoint.
 * Prisma requires the Node.js runtime and is not compatible with Edge.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/prisma/generated/client";

// --- Singleton client (server-only, reused across hot reloads) ---

const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

function getClient(): PrismaClient {
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

/**
 * The shared Prisma Client instance.
 * Use `withUser` for RLS-bound operations.
 */
export const prisma = getClient();

// --- RLS-context transaction helper ---

const USER_ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
} as const;

const USER_ROLE_VALUES = Object.values(USER_ROLES);

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface UserContext {
  /** Supabase auth user id (UUID). */
  userId: string;
  /** Roles made available to RLS policies. */
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

  if (!roles.every((role) => USER_ROLE_VALUES.includes(role))) {
    throw new Error('Invalid roles: only "admin" and "teacher" are allowed.');
  }
}

/**
 * Executes a callback inside an interactive transaction that sets the
 * Postgres session context for RLS evaluation:
 *
 * - `SET LOCAL ROLE authenticated` — assumes the RLS-bound role
 * - `SELECT set_config('request.jwt.claims', ..., true)` — provides auth.uid()
 *   and roles for the transaction only
 *
 * This ensures all queries within the transaction are subject to RLS policies
 * that inspect `current_setting('request.jwt.claims', true)`.
 *
 * @param ctx  User identity to inject into the transaction
 * @param fn   Callback receiving the transaction client
 */
export async function withUser<T>(
  ctx: UserContext,
  fn: (
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]
  ) => Promise<T>
): Promise<T> {
  validateUserContext(ctx);

  const { userId, roles } = ctx;
  const claims = JSON.stringify({ sub: userId, roles });

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true);`;
    return fn(tx);
  });
}
