/**
 * Server-only RLS executor.
 *
 * This module is the PRIVATE execution boundary for RLS-context transactions
 * in server actions. It consumes the trusted identity resolver
 * (`@/lib/auth/identity-resolver`) for authentication/role resolution — never
 * duplicating that logic or accepting caller-supplied user IDs, roles,
 * cookies, or contexts.
 *
 * The Prisma RLS helper is delegated to `@/lib/prisma/client` which owns the
 * singleton and the `withUser` function. Application code must use
 * `withAuthenticatedUser`.
 *
 * Supabase RLS remains the authorization authority.
 *
 * NEVER import this from middleware.ts or any Edge Runtime entrypoint.
 */

import "server-only";

import {
  getAuthenticatedContext as resolveIdentity,
  type IdentityResult,
} from "@/lib/auth/identity-resolver";
import type { AppRole, AppRoleAssignment } from "@/lib/auth/authorize";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import { withUser, type TransactionClient } from "@/lib/prisma/client";

// --- Re-exported types for downstream consumers ---

export interface AuthenticatedContext {
  userId: string;
  roles: AppRole[];
  assignments: AppRoleAssignment[];
}

export type AuthContextResult = IdentityResult;

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

  try {
    const data = await withUser(
      { userId: ctx.userId, roles: ctx.roles },
      (tx) => fn(tx, ctx)
    );
    return { success: true, data };
  } catch {
    // Do not expose raw PostgreSQL errors to callers
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}
