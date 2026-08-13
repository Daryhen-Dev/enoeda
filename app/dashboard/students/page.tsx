import { StudentList } from "@/components/students/student-list"
import { listBranches } from "@/lib/domain/branches/actions"
import {
  listStudents,
  STUDENT_STATUS,
  type StudentListItem,
} from "@/lib/domain/students"
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
  const [activeResult, inactiveResult, branchesResult] = await Promise.all([
    listStudents({ status: STUDENT_STATUS.ACTIVE }),
    listStudents({ status: STUDENT_STATUS.INACTIVE }),
    listBranches(),
  ])
  const activePage = activeResult.success ? activeResult.data : undefined
  const inactivePage = inactiveResult.success ? inactiveResult.data : undefined
  const branches =
    branchesResult.success && branchesResult.data !== undefined
      ? branchesResult.data
          .filter((branch) => branch.is_active)
          .map((branch) => ({ id: branch.id, name: branch.name }))
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
      />
    </main>
  )
}
