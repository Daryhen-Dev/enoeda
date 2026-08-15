import { StudentList } from "@/components/students/student-list"
import { listBranches } from "@/lib/domain/branches/actions"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import {
  listStudents,
  STUDENT_STATUS,
  type StudentListItem,
} from "@/lib/domain/students"
import { getAuthenticatedContext } from "@/lib/auth/server-context"
import { STUDENT_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

type StudentSummary = Pick<
  StudentListItem,
  "id" | "first_name" | "surname" | "branch_id"
>

function toStudentSummary({
  id,
  first_name,
  surname,
  branch_id,
}: StudentListItem): StudentSummary {
  return { id, first_name, surname, branch_id }
}

export default async function StudentsPage() {
  const [activeResult, inactiveResult, branchesResult, disciplinesResult, authResult] = await Promise.all([
    listStudents({ status: STUDENT_STATUS.ACTIVE }),
    listStudents({ status: STUDENT_STATUS.INACTIVE }),
    listBranches(),
    listDisciplines(),
    getAuthenticatedContext(),
  ])
  const activePage = activeResult.success ? activeResult.data : undefined
  const inactivePage = inactiveResult.success ? inactiveResult.data : undefined

  // Derive teacher-only context for branch locking (D6/A5)
  const isTeacherOnly =
    authResult.ok &&
    authResult.ctx.roles.includes("teacher") &&
    !authResult.ctx.roles.some((r) => r === "admin" || r === "owner")

  const teacherBranchIds = isTeacherOnly && authResult.ok
    ? authResult.ctx.assignments
        .filter((a) => a.role === "teacher" && a.branchId)
        .map((a) => a.branchId!)
    : []

  const allBranches =
    branchesResult.success && branchesResult.data !== undefined
      ? branchesResult.data
          .filter((branch) => branch.is_active)
          .map((branch) => ({ id: branch.id, name: branch.name }))
      : []

  // Teacher sees only their branches; admin/owner sees all
  const branches = isTeacherOnly
    ? allBranches.filter((b) => teacherBranchIds.includes(b.id))
    : allBranches

  // Lock branch when teacher has exactly one branch
  const lockedBranchId =
    isTeacherOnly && teacherBranchIds.length === 1
      ? teacherBranchIds[0]
      : undefined

  const disciplines =
    disciplinesResult.success && disciplinesResult.data !== undefined
      ? disciplinesResult.data.map((d) => ({ id: d.id, name: d.name }))
      : []

  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <StudentList
        activeItems={activePage?.items.map(toStudentSummary) ?? []}
        activeNextCursor={activePage?.next_cursor ?? null}
        activeInitialError={
          activeResult.success
            ? undefined
            : STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE
        }
        inactiveItems={inactivePage?.items.map(toStudentSummary) ?? []}
        inactiveNextCursor={inactivePage?.next_cursor ?? null}
        inactiveInitialError={
          inactiveResult.success
            ? undefined
            : STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE
        }
        branches={branches}
        disciplines={disciplines}
        lockedBranchId={lockedBranchId}
      />
    </main>
  )
}
