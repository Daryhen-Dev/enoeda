/**
 * Pure logic for self-enable teacher eligibility.
 *
 * Determines whether the current admin's row in the staff list should
 * show the "enable as teacher" action. The action must only appear:
 * - On the row belonging to currentUserId
 * - With role=admin for the active branchId
 * - When the user does NOT already have a teacher role in this branch
 */

export interface StaffAssignmentRow {
  user_id: string;
  role: string;
  branch_id: string | null;
  revoked_at?: string | null;
}

/**
 * Determines if the self-enable teacher action should be available
 * for a specific row in the staff list.
 *
 * @returns true if the row is the current user's admin assignment for
 *          the active branch AND they don't already have a teacher role.
 */
export function isSelfEnableEligibleRow(
  row: StaffAssignmentRow,
  currentUserId: string,
  branchId: string,
  allAssignments: StaffAssignmentRow[]
): boolean {
  // Must be the current user's row
  if (row.user_id !== currentUserId) return false;

  // Must be an admin role for this branch
  if (row.role !== "admin") return false;
  if (row.branch_id !== branchId) return false;

  // Must NOT already have a teacher role in this branch
  const alreadyTeacher = allAssignments.some(
    (assignment) =>
      assignment.user_id === currentUserId &&
      assignment.role === "teacher" &&
      assignment.branch_id === branchId &&
      (assignment.revoked_at === undefined || assignment.revoked_at === null)
  );

  return !alreadyTeacher;
}
