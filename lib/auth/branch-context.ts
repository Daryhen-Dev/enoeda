/**
 * Page-level branch context resolver.
 *
 * Resolves and validates the `?branch=<uuid>` search param against the
 * current user's active role assignments. Called by each operating RSC page
 * (never in layout or middleware).
 *
 * Returns a discriminated union the page acts on:
 * - valid: branch confirmed, proceed with scoped data
 * - redirect: single branch user, page should redirect preserving path+query
 * - selector: multi-branch user without valid param, show picker
 * - error: no branch assignments or unauthenticated
 */

import "server-only";

import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { withAuthenticatedUser } from "@/lib/auth/server-context";
import type { AppRoleAssignment } from "@/lib/auth/authorize";

// --- Result types ---

export type BranchContextResult =
  | { type: "valid"; branchId: string; canManage: boolean }
  | { type: "redirect"; branchId: string }
  | { type: "selector"; branches: { id: string; name: string }[] }
  | { type: "error" };

// --- Helpers ---

/** Roles that qualify for operational branch context. */
const OPERATIONAL_ROLES: Set<string> = new Set(["admin", "teacher"]);

/**
 * Extract unique branch IDs from assignments that have an operational role
 * (admin or teacher) and a non-null branchId. Owner and other roles are excluded.
 */
function uniqueOperationalBranchIds(assignments: AppRoleAssignment[]): string[] {
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.branchId && OPERATIONAL_ROLES.has(a.role)) {
      ids.add(a.branchId);
    }
  }
  return [...ids];
}

/** Check if admin assignment exists for a given branch. */
function hasAdminForBranch(
  assignments: AppRoleAssignment[],
  branchId: string
): boolean {
  return assignments.some(
    (a) => a.role === "admin" && a.branchId === branchId
  );
}

// --- Core resolver ---

/**
 * Resolves branch context from the URL `?branch` parameter against the
 * authenticated user's role assignments.
 *
 * Logic:
 * - Only admin/teacher assignments are considered (owner excluded)
 * - 0 unique operational branches → error
 * - 1 unique branch → validate active → match param → valid; else → redirect
 * - N>1 unique branches → validate active → match param → valid; else → selector
 * - Inactive branches are excluded; no UUID fallback for display names
 */
export async function resolveBranchContext(
  branchParam: string | undefined
): Promise<BranchContextResult> {
  const identity = await getAuthenticatedContext();

  if (!identity.ok) {
    return { type: "error" };
  }

  const { assignments } = identity.ctx;
  const branchIds = uniqueOperationalBranchIds(assignments);

  // 0 operational branches (e.g. owner-only with null branch_id)
  if (branchIds.length === 0) {
    return { type: "error" };
  }

  // Validate branches are active in DB (fetch names at the same time)
  const namesResult = await withAuthenticatedUser(async (tx) => {
    return tx.branches.findMany({
      where: { id: { in: branchIds }, is_active: true },
      select: { id: true, name: true },
    });
  });

  const activeBranches = namesResult.success ? namesResult.data : [];

  // No active branches found
  if (activeBranches.length === 0) {
    return { type: "error" };
  }

  const activeBranchIds = activeBranches.map((b) => b.id);

  // 1 active branch
  if (activeBranchIds.length === 1) {
    const singleBranch = activeBranchIds[0];
    if (branchParam === singleBranch) {
      return {
        type: "valid",
        branchId: singleBranch,
        canManage: hasAdminForBranch(assignments, singleBranch),
      };
    }
    return { type: "redirect", branchId: singleBranch };
  }

  // N>1 active branches — check param match
  if (branchParam && activeBranchIds.includes(branchParam)) {
    return {
      type: "valid",
      branchId: branchParam,
      canManage: hasAdminForBranch(assignments, branchParam),
    };
  }

  // No match → selector (only active branches with real names, never UUID fallback)
  return {
    type: "selector",
    branches: activeBranches.map((b) => ({ id: b.id, name: b.name })),
  };
}
