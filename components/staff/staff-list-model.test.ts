import { describe, expect, it } from "vitest"

import type { StaffAssignment } from "@/lib/domain/roles/actions"

import { groupStaffAssignmentsByBranchAndUser } from "./staff-list-model"

const BRANCH_A = "branch-a"
const BRANCH_B = "branch-b"

function createAssignment(
  overrides: Partial<StaffAssignment> = {}
): StaffAssignment {
  return {
    user_id: "user-1",
    role: "admin",
    branch_id: BRANCH_A,
    assigned_at: "2025-01-01T00:00:00.000Z",
    display_name: "Ana López",
    ...overrides,
  }
}

describe("groupStaffAssignmentsByBranchAndUser", () => {
  it("groups one person's admin and teacher assignments in the same branch", () => {
    const assignments: StaffAssignment[] = [
      createAssignment(),
      createAssignment({ role: "teacher", assigned_at: "2025-01-02T00:00:00.000Z" }),
    ]

    const members = groupStaffAssignmentsByBranchAndUser(assignments)

    expect(members).toHaveLength(1)
    expect(members[0]?.assignments.map((assignment) => assignment.role)).toEqual(["admin", "teacher"])
    expect(members[0]?.assignments.map((assignment) => assignment.assigned_at)).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2025-01-02T00:00:00.000Z",
    ])
  })

  it("returns separate groups for two people", () => {
    const members = groupStaffAssignmentsByBranchAndUser([
      createAssignment(),
      createAssignment({ user_id: "user-2", display_name: "Luis Pérez" }),
    ])

    expect(members).toHaveLength(2)
    expect(members.map((member) => member.userId)).toEqual(["user-1", "user-2"])
  })

  it("does not merge one person across branches", () => {
    const members = groupStaffAssignmentsByBranchAndUser([
      createAssignment(),
      createAssignment({ branch_id: BRANCH_B, role: "teacher" }),
    ])

    expect(members).toHaveLength(2)
    expect(members.map((member) => member.branchId)).toEqual([BRANCH_A, BRANCH_B])
  })

  it("returns no groups for no assignments", () => {
    expect(groupStaffAssignmentsByBranchAndUser([])).toEqual([])
  })
})
