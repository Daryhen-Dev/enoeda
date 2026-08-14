/**
 * Server-only role fetcher for layouts and pages.
 *
 * Uses the identity resolver to obtain the current user's active roles.
 * This module is NOT importable from middleware or Edge Runtime.
 */

import "server-only";

import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import type { AppRole, AppRoleAssignment } from "@/lib/auth/authorize";

/**
 * Fetch the current user's active application roles (names only).
 * Returns an empty array if unauthenticated or no recognized roles.
 */
export async function fetchCurrentRoles(): Promise<AppRole[]> {
  const result = await getAuthenticatedContext();
  if (!result.ok) return [];
  return result.ctx.roles;
}

/**
 * Fetch the current user's full branch-scoped role assignments.
 * Returns an empty array if unauthenticated or no recognized roles.
 */
export async function fetchRoleAssignments(): Promise<AppRoleAssignment[]> {
  const result = await getAuthenticatedContext();
  if (!result.ok) return [];
  return result.ctx.assignments;
}
