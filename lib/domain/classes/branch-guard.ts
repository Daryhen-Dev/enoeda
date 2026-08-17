/**
 * Shared mutation branch guard — fail-closed context enforcement.
 *
 * Runs INSIDE the RLS-bound transaction (withAuthenticatedUser).
 * Compares the caller's validated branch context against the target
 * entity's persisted branch. Rejects on mismatch or missing row.
 *
 * RLS remains the final authority; this guard is defense-in-depth.
 */

import "server-only";

import type { TransactionClient } from "@/lib/prisma/client";
import { CLASS_MESSAGES } from "@/lib/localization/es-ec";

export type BranchGuardResult = { ok: true } | { ok: false; error: string };

/**
 * Assert that a scheduled class belongs to the caller's active branch context.
 *
 * @param tx - Prisma transaction client (RLS-bound)
 * @param scheduledClassId - Target class ID
 * @param contextBranchId - Caller's validated active branch
 * @returns ok:true if match, ok:false with error message otherwise
 */
export async function assertClassInContext(
  tx: TransactionClient,
  scheduledClassId: string,
  contextBranchId: string
): Promise<BranchGuardResult> {
  const row = await tx.scheduled_classes.findUnique({
    where: { id: scheduledClassId },
    select: { branch_id: true },
  });

  if (!row) {
    return { ok: false, error: CLASS_MESSAGES.NOT_FOUND };
  }

  if (row.branch_id !== contextBranchId) {
    return { ok: false, error: CLASS_MESSAGES.BRANCH_MISMATCH };
  }

  return { ok: true };
}
