/**
 * Shared server-only assertion: validates the authenticated caller has an
 * active admin or teacher assignment for the given branchId.
 *
 * This is the domain-boundary guard for ALL class/operational mutations.
 * It validates from the transaction context (not raw UUID input), rejecting:
 * - Absent branchId
 * - Invalid/non-UUID branchId
 * - Caller having no active admin/teacher assignment for that branch
 *
 * RLS remains authoritative; this is defense-in-depth at the application layer.
 */

import "server-only";

import { CLASS_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec";
import type { AuthenticatedContext } from "@/lib/auth/server-context";

export type BranchAssignmentAssertionResult =
  | { ok: true; branchId: string }
  | { ok: false; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Assert that the authenticated caller has an active admin or teacher
 * assignment for the given branchId. Fails closed on any violation.
 */
export function assertActiveBranchAssignment(
  ctx: AuthenticatedContext,
  branchId: string | undefined | null
): BranchAssignmentAssertionResult {
  // Reject absent/empty
  if (!branchId) {
    return { ok: false, error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED };
  }

  // Reject non-UUID
  if (!UUID_REGEX.test(branchId)) {
    return { ok: false, error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED };
  }

  // Check caller has an active admin or teacher assignment for this branch
  const hasAssignment = ctx.assignments.some(
    (a) =>
      (a.role === "admin" || a.role === "teacher") &&
      a.branchId === branchId
  );

  if (!hasAssignment) {
    return { ok: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  return { ok: true, branchId };
}
