import type { StaffAssignment } from "@/lib/domain/roles/actions"

export interface StaffListMember {
  userId: string
  branchId: string | null
  displayName: string | undefined
  email: StaffAssignment["email"]
  assignments: StaffAssignment[]
}

/** Groups staff assignments by their exact branch and user identity. */
export function groupStaffAssignmentsByBranchAndUser(
  assignments: StaffAssignment[]
): StaffListMember[] {
  const membersByBranchAndUser = new Map<string, StaffListMember>()

  for (const assignment of assignments) {
    const key = JSON.stringify([assignment.branch_id, assignment.user_id])
    const existingMember = membersByBranchAndUser.get(key)

    if (existingMember) {
      existingMember.assignments.push(assignment)
      continue
    }

    membersByBranchAndUser.set(key, {
      userId: assignment.user_id,
      branchId: assignment.branch_id,
      displayName: assignment.display_name,
      email: assignment.email,
      assignments: [assignment],
    })
  }

  return Array.from(membersByBranchAndUser.values())
}
