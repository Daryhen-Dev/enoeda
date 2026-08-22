/**
 * Page-level branch context resolver.
 *
 * Resolves and validates the `?branch=<uuid>` search param against the
 * current user's active role assignments. Called by each operating RSC page
 * (never in layout or middleware).
 */

import "server-only";

import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { withAuthenticatedUser } from "@/lib/auth/server-context";
import type { AppRoleAssignment } from "@/lib/auth/authorize";
import {
  ECUADOR_TIME_ZONES,
  ECUADOR_TIME_ZONE_VALUES,
  type EcuadorTimeZone,
} from "@/lib/domain/branches/schema";

interface ActiveBranch {
  id: string;
  name: string;
  timeZone: EcuadorTimeZone;
}

interface ActiveBranchRow {
  id: string;
  name: string;
  time_zone?: string | null;
}

export interface ResolveBranchContextOptions {
  allowGlobalAdminRead?: boolean;
}

export type BranchContextResult =
  | {
      type: "valid";
      branchId: string;
      branchName: string;
      timeZone: EcuadorTimeZone;
      canManage: boolean;
      isGlobalAdminReadOnly?: true;
    }
  | { type: "redirect"; branchId: string }
  | { type: "selector"; branches: { id: string; name: string }[] }
  | { type: "error" };

const OPERATIONAL_ROLES: Set<string> = new Set(["admin", "teacher"]);

function normalizeEcuadorTimeZone(
  timeZone: string
): EcuadorTimeZone | undefined {
  return ECUADOR_TIME_ZONE_VALUES.find(
    (allowedTimeZone) => allowedTimeZone === timeZone
  );
}

function uniqueOperationalBranchIds(assignments: AppRoleAssignment[]): string[] {
  const ids = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.branchId && OPERATIONAL_ROLES.has(assignment.role)) {
      ids.add(assignment.branchId);
    }
  }
  return [...ids];
}

function hasAdminForBranch(
  assignments: AppRoleAssignment[],
  branchId: string
): boolean {
  return assignments.some(
    (assignment) => assignment.role === "admin" && assignment.branchId === branchId
  );
}

function hasOperationalAssignmentForBranch(
  assignments: AppRoleAssignment[],
  branchId: string
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.branchId === branchId && OPERATIONAL_ROLES.has(assignment.role)
  );
}

function toActiveBranches(branches: ActiveBranchRow[]): ActiveBranch[] {
  return branches.flatMap((branch) => {
    const timeZone = normalizeEcuadorTimeZone(
      branch.time_zone ?? ECUADOR_TIME_ZONES.CONTINENTAL
    );

    return timeZone === undefined
      ? []
      : [{ id: branch.id, name: branch.name, timeZone }];
  });
}

function resolveActiveBranchContext(
  activeBranches: ActiveBranch[],
  branchParam: string | undefined,
  assignments: AppRoleAssignment[],
  isGlobalAdminReadMode: boolean
): BranchContextResult {
  const selectedBranch = activeBranches.find((branch) => branch.id === branchParam);
  if (selectedBranch !== undefined) {
    const result = {
      type: "valid" as const,
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
      timeZone: selectedBranch.timeZone,
      canManage: hasAdminForBranch(assignments, selectedBranch.id),
    };

    return isGlobalAdminReadMode &&
      !hasOperationalAssignmentForBranch(assignments, selectedBranch.id)
      ? { ...result, isGlobalAdminReadOnly: true }
      : result;
  }

  if (activeBranches.length === 1) {
    const [singleBranch] = activeBranches;
    if (!singleBranch) return { type: "error" };
    return { type: "redirect", branchId: singleBranch.id };
  }

  return {
    type: "selector",
    branches: activeBranches.map((branch) => ({
      id: branch.id,
      name: branch.name,
    })),
  };
}

export async function resolveBranchContext(
  branchParam: string | undefined,
  options: ResolveBranchContextOptions = {}
): Promise<BranchContextResult> {
  const identity = await getAuthenticatedContext();
  if (!identity.ok) return { type: "error" };

  const { assignments } = identity.ctx;
  const operationalBranchIds = uniqueOperationalBranchIds(assignments);
  if (operationalBranchIds.length === 0) return { type: "error" };

  const branchesResult = await withAuthenticatedUser(async (tx) => {
    const localBranches = await tx.branches.findMany({
      where: { id: { in: operationalBranchIds }, is_active: true },
      select: { id: true, name: true, time_zone: true },
    });

    const hasActiveAdminAssignment = localBranches.some((branch) =>
      hasAdminForBranch(assignments, branch.id)
    );
    if (options.allowGlobalAdminRead !== true || !hasActiveAdminAssignment) {
      return { branches: localBranches, isGlobalAdminReadMode: false };
    }

    const globalBranches = await tx.branches.findMany({
      where: { is_active: true },
      select: { id: true, name: true, time_zone: true },
    });
    return { branches: globalBranches, isGlobalAdminReadMode: true };
  });

  if (!branchesResult.success) return { type: "error" };

  const activeBranches = toActiveBranches(branchesResult.data.branches);
  if (activeBranches.length === 0) return { type: "error" };

  return resolveActiveBranchContext(
    activeBranches,
    branchParam,
    assignments,
    branchesResult.data.isGlobalAdminReadMode
  );
}
