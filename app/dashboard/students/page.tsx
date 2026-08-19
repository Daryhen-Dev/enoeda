import { redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchSelector } from "@/components/branch/branch-selector"
import { StudentList } from "@/components/students/student-list"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import {
  listStudents,
  STUDENT_STATUS,
} from "@/lib/domain/students"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { STUDENT_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

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
    const otherParams: Record<string, string> = Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string] =>
          entry[0] !== "branch" && entry[1] !== undefined,
      ),
    )
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/students"
        currentParams={otherParams}
      />
    )
  }

  const branchId = branchResult.branchId
  const branches = [{ id: branchId, name: branchResult.branchName }]

  const [activeResult, inactiveResult, disciplinesResult] = await Promise.all([
    listStudents({ status: STUDENT_STATUS.ACTIVE, branch_id: branchId }),
    listStudents({ status: STUDENT_STATUS.INACTIVE, branch_id: branchId }),
    listDisciplines(),
  ])

  const activePage = activeResult.success ? activeResult.data : undefined
  const inactivePage = inactiveResult.success ? inactiveResult.data : undefined
  const disciplines =
    disciplinesResult.success && disciplinesResult.data !== undefined
      ? disciplinesResult.data.map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
        }))
      : []

  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <StudentList
        activeItems={activePage?.items ?? []}
        activeNextCursor={activePage?.next_cursor ?? null}
        activeInitialError={
          activeResult.success
            ? undefined
            : STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE
        }
        inactiveItems={inactivePage?.items ?? []}
        inactiveNextCursor={inactivePage?.next_cursor ?? null}
        inactiveInitialError={
          inactiveResult.success
            ? undefined
            : STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE
        }
        branches={branches}
        disciplines={disciplines}
        lockedBranchId={branchId}
        branchId={branchId}
      />
    </main>
  )
}
