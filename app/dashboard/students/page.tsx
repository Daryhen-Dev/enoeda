import { redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchSelector } from "@/components/branch/branch-selector"
import { StudentList } from "@/components/students/student-list"
import { listBranches } from "@/lib/domain/branches/actions"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import {
  listStudents,
  STUDENT_STATUS,
  type StudentListItem,
} from "@/lib/domain/students"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { STUDENT_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

type StudentSummary = Pick<
  StudentListItem,
  | "id"
  | "first_name"
  | "surname"
  | "branch_id"
  | "branch_name"
  | "active_discipline_names"
>

function toStudentSummary({
  id,
  first_name,
  surname,
  branch_id,
  branch_name,
  active_discipline_names,
}: StudentListItem): StudentSummary {
  return {
    id,
    first_name,
    surname,
    branch_id,
    branch_name,
    active_discipline_names,
  }
}

interface StudentsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{STUDENT_DIRECTORY_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {STUDENT_DIRECTORY_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/students?${redirectParams.toString()}`)
  }

  if (branchResult.type === "selector") {
    const { branch: _, ...otherParams } = params
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/students"
        currentParams={otherParams as Record<string, string>}
      />
    )
  }

  // Valid branch — fetch data scoped to branch
  const branchId = branchResult.branchId

  const [activeResult, inactiveResult, branchesResult, disciplinesResult] =
    await Promise.all([
      listStudents({ status: STUDENT_STATUS.ACTIVE }),
      listStudents({ status: STUDENT_STATUS.INACTIVE }),
      listBranches(),
      listDisciplines(),
    ])

  const activePage = activeResult.success ? activeResult.data : undefined
  const inactivePage = inactiveResult.success ? inactiveResult.data : undefined

  const allBranches =
    branchesResult.success && branchesResult.data !== undefined
      ? branchesResult.data
          .filter((branch) => branch.is_active)
          .map((branch) => ({ id: branch.id, name: branch.name }))
      : []

  // Scope branches to validated branch context
  const branches = allBranches.filter((b) => b.id === branchId)

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
        lockedBranchId={branchId}
      />
    </main>
  )
}
