import { redirect } from "next/navigation"

import {
  BranchManager,
  BRANCH_DIRECTORY_STATUS,
  type BranchDirectoryResult,
} from "@/components/branches/branch-manager"
import { APP_ROLES } from "@/lib/auth/authorize"
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver"
import { listBranches } from "@/lib/domain/branches/actions"
import { BRANCH_STATUS } from "@/lib/domain/branches/schema"
import { BRANCH_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

function toDirectoryResult(
  result: Awaited<ReturnType<typeof listBranches>>
): BranchDirectoryResult {
  return result.success
    ? { status: BRANCH_DIRECTORY_STATUS.READY, branches: result.data ?? [] }
    : {
        status: BRANCH_DIRECTORY_STATUS.ERROR,
        error: result.error ?? BRANCH_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE,
      }
}

interface BranchesPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function BranchesPage({
  searchParams,
}: BranchesPageProps) {
  const params = await searchParams
  const identityResult = await getAuthenticatedContext()
  const isTeacherOnly =
    identityResult.ok &&
    identityResult.ctx.roles.includes(APP_ROLES.TEACHER) &&
    !identityResult.ctx.roles.includes(APP_ROLES.ADMIN)

  if (isTeacherOnly) {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) redirectParams.append(key, value)
    }
    const queryString = redirectParams.toString()
    redirect(
      queryString
        ? `/dashboard/calendar?${queryString}`
        : "/dashboard/calendar"
    )
  }

  const [activeResult, historyResult] = await Promise.all([
    listBranches({ status: BRANCH_STATUS.ACTIVE }),
    listBranches({ status: BRANCH_STATUS.INACTIVE }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <BranchManager
        activeResult={toDirectoryResult(activeResult)}
        historyResult={toDirectoryResult(historyResult)}
      />
    </div>
  )
}
