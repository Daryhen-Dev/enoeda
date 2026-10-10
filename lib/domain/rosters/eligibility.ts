/**
 * Pure roster eligibility classification — mirrors the DB trigger
 * private.assert_roster_eligibility (migration 20260910000000):
 *   1. roster_student_branch_mismatch — student does not belong to branch
 *   2. roster_student_inactive — student is not active
 *   3. roster_student_not_eligible — no active monthly-billed enrollment
 *      in the class discipline
 *
 * Kept free of server-only imports so it can be exported from the barrel
 * (actions.ts is a "use server" module, which may only export async
 * functions) and unit-tested without any environment mocking.
 *
 * The `enrollment` argument is the caller's pre-fetched enrollment row for
 * (student_id, target discipline), or null when the student has none.
 */

export type RosterEligibilityStatus =
  | "eligible"
  | "branch_mismatch"
  | "inactive"
  | "not_eligible";

export interface RosterEligibilityStudent {
  student_id: string;
  branch_id: string | null;
  is_active: boolean;
}

export interface RosterEligibilityEnrollment {
  is_active: boolean;
  billing_mode: string;
}

export function classifyRosterEligibility(
  student: RosterEligibilityStudent | null | undefined,
  enrollment: RosterEligibilityEnrollment | null | undefined,
  targetBranchId: string
): RosterEligibilityStatus {
  if (!student || student.branch_id !== targetBranchId) {
    return "branch_mismatch";
  }
  if (!student.is_active) {
    return "inactive";
  }
  if (
    !enrollment ||
    enrollment.is_active !== true ||
    enrollment.billing_mode !== "monthly"
  ) {
    return "not_eligible";
  }
  return "eligible";
}
