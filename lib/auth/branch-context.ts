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
import type { AppRoleAssignment } from "@/lib/auth/authorize";

// --- Result types ---

export type BranchContextResult =
  | { type: "valid"; branchId: string; canManage: boolean }
  | { type: "redirect"; branchId: string }
  | { type: "selector"; branches: { id: string; name: string }[] }
  | { type: "error" };

// --- Helpers ---

/** Extract unique branch IDs from assignments (null branch_id excluded). */
function uniqueBranchIds(assignments: AppRoleAssignment[]): string[] {
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.branchId) ids.add(a.branchId);
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
 * - 0 unique branches → error
 * - 1 unique branch → match param → valid; else → redirect
 * - N>1 unique branches → match param → valid; else → selector
 */
export async function resolveBranchContext(
  branchParam: string | undefined
): Promise<BranchContextResult> {
  const identity = await getAuthenticatedContext();

  if (!identity.ok) {
    return { type: "error" };
  }

  const { assignments } = identity.ctx;
  const branchIds = uniqueBranchIds(assignments);

  // 0 branches (e.g. owner-only with null branch_id)
  if (branchIds.length === 0) {
    return { type: "error" };
  }

  // 1 branch
  if (branchIds.length === 1) {
    const singleBranch = branchIds[0];
    if (branchParam === singleBranch) {
      return {
        type: "valid",
        branchId: singleBranch,
        canManage: hasAdminForBranch(assignments, singleBranch),
      };
    }
    return { type: "redirect", branchId: singleBranch };
  }

  // N>1 branches
  if (branchParam && branchIds.includes(branchParam)) {
    return {
      type: "valid",
      branchId: branchParam,
      canManage: hasAdminForBranch(assignments, branchParam),
    };
  }

  // No match → selector (branch names resolved later by caller or via DB)
  return {
    type: "selector",
    branches: branchIds.map((id) => ({ id, name: id })),
  };
}
