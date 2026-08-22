import type { AuthenticatedContext } from "@/lib/auth/server-context";
import type { TransactionClient } from "@/lib/prisma/client";

export const BRANCH_READ_ACCESS = {
  LOCAL_OPERATIONAL: "local_operational",
  GLOBAL_ADMIN_READ_ONLY: "global_admin_read_only",
  DENIED: "denied",
} as const;

export type BranchReadAccess =
  (typeof BRANCH_READ_ACCESS)[keyof typeof BRANCH_READ_ACCESS];

export interface BranchReadOptions {
  allowGlobalAdminRead?: boolean;
}

export interface BranchReadAuthorization {
  access: BranchReadAccess;
}

function hasLocalOperationalAssignment(
  ctx: AuthenticatedContext,
  branchId: string
): boolean {
  return ctx.assignments.some(
    (assignment) =>
      assignment.branchId === branchId &&
      (assignment.role === "admin" || assignment.role === "teacher")
  );
}

function getAdminAssignmentBranchIds(ctx: AuthenticatedContext): string[] {
  return [
    ...new Set(
      ctx.assignments.flatMap((assignment) =>
        assignment.role === "admin" && assignment.branchId
          ? [assignment.branchId]
          : []
      )
    ),
  ];
}

/**
 * Authorizes an active destination branch for read-only operating data.
 * Local admin/teacher assignments retain normal branch access. Calendar,
 * Payments, and their discipline filter may opt into the narrowly scoped
 * global-admin path; it never grants a local management capability.
 */
export async function authorizeBranchRead(
  tx: TransactionClient,
  ctx: AuthenticatedContext,
  branchId: string,
  options: BranchReadOptions = {}
): Promise<BranchReadAuthorization> {
  const destination = await tx.branches.findFirst({
    where: { id: branchId, is_active: true },
    select: { id: true },
  });

  if (!destination) {
    return { access: BRANCH_READ_ACCESS.DENIED };
  }

  if (hasLocalOperationalAssignment(ctx, branchId)) {
    return { access: BRANCH_READ_ACCESS.LOCAL_OPERATIONAL };
  }

  if (options.allowGlobalAdminRead !== true) {
    return { access: BRANCH_READ_ACCESS.DENIED };
  }

  const adminBranchIds = getAdminAssignmentBranchIds(ctx);
  if (adminBranchIds.length === 0) {
    return { access: BRANCH_READ_ACCESS.DENIED };
  }

  const activeAdminBranch = await tx.branches.findFirst({
    where: { id: { in: adminBranchIds }, is_active: true },
    select: { id: true },
  });

  return activeAdminBranch
    ? { access: BRANCH_READ_ACCESS.GLOBAL_ADMIN_READ_ONLY }
    : { access: BRANCH_READ_ACCESS.DENIED };
}
