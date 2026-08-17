/**
 * Pure helper for extracting operational branch info from role assignments.
 *
 * Filters assignments to only admin/teacher roles and resolves them against
 * a branch lookup, omitting entries where the branch is absent or inactive.
 * Never falls back to showing raw UUIDs.
 *
 * This module is Edge-safe — no I/O, no server imports.
 */

import type { AppRoleAssignment } from "@/lib/auth/authorize";

/** Minimal branch info for the header switcher. */
export interface BranchInfo {
  id: string;
  name: string;
}

/** Lookup entry representing an active branch row. */
export interface ActiveBranchEntry {
  id: string;
  name: string;
  is_active: boolean;
}

/** Roles that qualify for operational branch context. */
const OPERATIONAL_ROLES: ReadonlySet<string> = new Set(["admin", "teacher"]);

/**
 * Extract unique branch IDs from assignments that have an operational role
 * (admin or teacher) and a non-null branchId.
 */
export function getOperationalBranchIds(
  assignments: AppRoleAssignment[]
): string[] {
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.branchId && OPERATIONAL_ROLES.has(a.role)) {
      ids.add(a.branchId);
    }
  }
  return [...ids];
}

/**
 * Given operational branch IDs and a list of all fetched branches,
 * return only those that are active and have real names.
 * Omits branches that are inactive, missing from the lookup, or have no name.
 * Never falls back to UUID as display name.
 */
export function resolveActiveBranches(
  operationalBranchIds: string[],
  allBranches: ActiveBranchEntry[]
): BranchInfo[] {
  const activeMap = new Map<string, string>();
  for (const b of allBranches) {
    if (b.is_active && b.name) {
      activeMap.set(b.id, b.name);
    }
  }

  const result: BranchInfo[] = [];
  for (const id of operationalBranchIds) {
    const name = activeMap.get(id);
    if (name) {
      result.push({ id, name });
    }
  }
  return result;
}
