import { StudentList } from "@/components/students/student-list"
import { listBranches } from "@/lib/domain/branches/actions"
import { listStudents } from "@/lib/domain/students/actions"

const GENERIC_LOAD_ERROR = "Unable to load students. Please try again."

export default async function StudentsPage() {
  const [studentsResult, branchesResult] = await Promise.all([
    listStudents(),
    listBranches(),
  ])
  const page = studentsResult.success ? studentsResult.data : undefined
  const initialItems =
    page?.items.map((student) => ({
      id: student.id,
      first_name: student.first_name,
      surname: student.surname,
      branch_id: student.branch_id,
      is_active: student.is_active,
    })) ?? []
  const branches = branchesResult.success
    ? branchesResult.data
        .filter((branch) => branch.is_active)
        .map((branch) => ({ id: branch.id, name: branch.name }))
    : []

  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <StudentList
        items={initialItems}
        nextCursor={page?.next_cursor ?? null}
        initialError={studentsResult.success ? undefined : GENERIC_LOAD_ERROR}
        branches={branches}
      />
    </main>
  )
}
