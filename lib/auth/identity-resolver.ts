/**
 * Server-only identity resolver.
 *
 * Resolves the current authenticated user and their active application roles
 * from the cookie-backed Supabase server client. This module establishes
 * server-derived identity ONLY — it does not execute RLS transactions, touch
 * Prisma, or accept caller-supplied user IDs, roles, cookies, or contexts.
 *
 * Supabase RLS remains the authorization authority; this resolver provides
 * the identity foundation that downstream modules consume.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseAppRoles, type AppRole } from "@/lib/auth/authorize";

// --- Result types ---

export const IDENTITY_REASONS = {
  UNAUTHENTICATED: "unauthenticated",
  NO_ROLES: "no_roles",
} as const;

export type IdentityReason =
  (typeof IDENTITY_REASONS)[keyof typeof IDENTITY_REASONS];

/** Authenticated identity context returned on success. */
export interface AuthenticatedIdentity {
  userId: string;
  roles: AppRole[];
}

/** Discriminated union result for identity resolution. */
export type IdentityResult =
  | { ok: true; ctx: AuthenticatedIdentity }
  | { ok: false; reason: IdentityReason };

// --- Core resolver ---

/**
 * Resolves the current authenticated user and their active roles from
 * Supabase Auth session (cookie-based) and the `current_roles()` DB RPC.
 *
 * Uses the SAME Supabase client instance for both `auth.getUser()` and
 * the RPC call, ensuring session consistency.
 *
 * Returns a discriminated union:
 * - `{ ok: true, ctx }` — authenticated with at least one recognized AppRole.
 * - `{ ok: false, reason: "unauthenticated" }` — auth fails or no user.
 * - `{ ok: false, reason: "no_roles" }` — RPC failure, null data, or no recognized roles.
 */
export async function getAuthenticatedContext(): Promise<IdentityResult> {
  const supabase = await createClient();

  // 1. Verify the user is authenticated (server-side, cookie-based)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // 2. Fetch active roles from DB via current_roles() RPC
  const { data: rolesData, error: rolesError } =
    await supabase.rpc("current_roles");

  if (rolesError || !rolesData) {
    return { ok: false, reason: "no_roles" };
  }

  // 3. Filter to recognized application roles only
  const roles = parseAppRoles(rolesData);
  if (roles.length === 0) {
    return { ok: false, reason: "no_roles" };
  }

  return { ok: true, ctx: { userId: user.id, roles } };
}
