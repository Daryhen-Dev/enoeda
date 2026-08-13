/**
 * Server-only RLS executor.
 *
 * This module is the PRIVATE execution boundary for RLS-context transactions
 * in server actions. It consumes the trusted identity resolver
 * (`@/lib/auth/identity-resolver`) for authentication/role resolution — never
 * duplicating that logic or accepting caller-supplied user IDs, roles,
 * cookies, or contexts.
 *
 * The Prisma singleton is constructed HERE and is never exported or accessible
 * outside this module. Application code must use `withAuthenticatedUser`.
 *
 * Supabase RLS remains the authorization authority. The raw claims setter
 * (`withUser`) is module-private and never exported.
 *
 * NEVER import this from middleware.ts or any Edge Runtime entrypoint.
 */

import "server-only";

import {
  getAuthenticatedContext as resolveIdentity,
  type IdentityResult,
} from "@/lib/auth/identity-resolver";
import type { AppRole } from "@/lib/auth/authorize";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/prisma/generated/client";

// --- Module-private Prisma singleton (never exported) ---

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

// --- Re-exported types for downstream consumers ---

export interface AuthenticatedContext {
  userId: string;
  roles: AppRole[];
}

export type AuthContextResult = IdentityResult;

// --- Module-private RLS transaction helper ---

/** Allowed user roles for RLS claims injection. */
const USER_ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
} as const;

const USER_ROLE_VALUES: readonly string[] = Object.values(USER_ROLES);

type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

interface UserContext {
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

/** Transaction client type extracted from Prisma's $transaction callback. */
type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

/**
 * Executes a callback inside an interactive transaction that sets the
 * Postgres session context for RLS evaluation:
 *
 * - `SET LOCAL ROLE authenticated` — assumes the RLS-bound role
 * - `SELECT set_config('request.jwt.claims', ..., true)` — provides auth.uid()
 *   and roles for the transaction only
 *
 * This is MODULE-PRIVATE. External consumers must use `withAuthenticatedUser`,
 * which derives identity from the server session, never from client input.
 */
async function withUser<T>(
  ctx: UserContext,
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  validateUserContext(ctx);

  const { userId, roles } = ctx;
  const claims = JSON.stringify({ sub: userId, roles });
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true);`;
    return fn(tx);
  });
}

// --- Adapter: map IdentityResult to legacy AuthContextResult ---

function toAuthContextResult(identity: IdentityResult): AuthContextResult {
  if (identity.ok) {
    return { ok: true, ctx: identity.ctx };
  }
  return { ok: false, reason: identity.reason };
}

// --- Public API: identity resolution delegated to trusted resolver ---

/**
 * Resolves the current authenticated user and their active roles by
 * delegating to the trusted identity resolver.
 *
 * Returns a discriminated union:
 * - `{ ok: true, ctx }` when authenticated with at least one role.
 * - `{ ok: false, reason }` distinguishing unauthenticated from no-roles.
 */
export async function getAuthenticatedContext(): Promise<AuthContextResult> {
  const identity = await resolveIdentity();
  return toAuthContextResult(identity);
}

// --- Transaction helper: run a DB operation with authenticated RLS context ---

/**
 * Resolves the authenticated user via the trusted identity resolver, then
 * executes the provided callback inside an RLS-bound Prisma transaction.
 *
 * This is the preferred way to run DB operations in server actions:
 * identity is NEVER accepted from the client.
 *
 * @returns ActionResult-compatible object with success/data/error.
 */
export async function withAuthenticatedUser<T>(
  fn: (
    tx: TransactionClient,
    ctx: AuthenticatedContext
  ) => Promise<T>
): Promise<
  | { success: true; data: T }
  | { success: false; error: string }
> {
  const authResult = await getAuthenticatedContext();

  if (!authResult.ok) {
    const message =
      authResult.reason === "unauthenticated"
        ? COMMON_MESSAGES.AUTHENTICATION_REQUIRED
        : COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS;
    return { success: false, error: message };
  }

  const { ctx } = authResult;
  const userContext: UserContext = {
    userId: ctx.userId,
    roles: ctx.roles,
  };

  try {
    const data = await withUser(userContext, (tx) => fn(tx, ctx));
    return { success: true, data };
  } catch {
    // Do not expose raw PostgreSQL errors to callers
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
