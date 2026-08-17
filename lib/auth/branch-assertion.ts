/**
 * Branch context assertion for server actions.
 *
 * Provides a reusable guard that validates the caller has an active
 * operational assignment (admin or teacher) for the requested branch_id.
 * Must be called inside withAuthenticatedUser before any query or mutation
 * that is branch-scoped.
 *
 * Fail-closed: missing or mismatched branch context rejects immediately.
 */

import type { AuthenticatedContext } from "@/lib/auth/server-context";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";

export const BRANCH_ASSERTION_MESSAGES = {
  MISSING_BRANCH_CONTEXT: "Contexto de sucursal requerido.",
  CALLER_NOT_ASSIGNED: "No tiene asignación activa en la sucursal indicada.",
  CROSS_BRANCH_DENIED: "Operación denegada: el recurso pertenece a otra sucursal.",
} as const;

/** Roles that qualify as operational branch context. */
const OPERATIONAL_ROLES: Set<string> = new Set(["admin", "teacher"]);

/**
 * Asserts that the authenticated caller has an active operational assignment
 * (admin or teacher) for the given branchId.
 *
 * @returns null when assertion passes, or an error string to short-circuit.
 */
export function assertCallerBranchContext(
  ctx: AuthenticatedContext,
  branchId: string
): string | null {
  if (!branchId) {
    return BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT;
  }

  const hasAssignment = ctx.assignments.some(
    (a) => a.branchId === branchId && OPERATIONAL_ROLES.has(a.role)
  );

  if (!hasAssignment) {
    return BRANCH_ASSERTION_MESSAGES.CALLER_NOT_ASSIGNED;
  }

  return null;
}

/**
 * Validates that a persisted resource's branch_id matches the caller's
 * requested branch context. Prevents cross-branch data access via raw IDs.
 *
 * @returns null when assertion passes, or an error string to short-circuit.
 */
export function assertResourceBranchOwnership(
  resourceBranchId: string,
  requestedBranchId: string
): string | null {
  if (resourceBranchId !== requestedBranchId) {
    return BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED;
  }
  return null;
}

/**
 * Combined: assert caller context + resource ownership in one call.
 * Useful for mutations on existing rows.
 */
export function assertBranchContextAndOwnership(
  ctx: AuthenticatedContext,
  requestedBranchId: string,
  resourceBranchId: string
): string | null {
  const callerError = assertCallerBranchContext(ctx, requestedBranchId);
  if (callerError) return callerError;

  return assertResourceBranchOwnership(resourceBranchId, requestedBranchId);
}
