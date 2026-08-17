import { AlertCircleIcon, UsersIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StaffList } from "@/components/staff/staff-list"
import { GrantRoleDialog } from "@/components/staff/grant-role-dialog"
import { BranchSelector } from "@/components/branch/branch-selector"
import { listBranchStaff } from "@/lib/domain/roles/actions"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { TEACHER_MANAGEMENT_MESSAGES } from "@/lib/localization/es-ec"

interface StaffPageProps {
  searchParams: Promise<{ branch?: string }>
}

/**
 * Admin-scoped teacher management page.
 * Shows teachers assigned to the admin's branch via validated context.
 */
export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{TEACHER_MANAGEMENT_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {TEACHER_MANAGEMENT_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (branchResult.type === "redirect") {
    redirect(`/dashboard/staff?branch=${branchResult.branchId}`)
  }

  if (branchResult.type === "selector") {
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/staff"
        currentParams={{}}
      />
    )
  }

  const branchId = branchResult.branchId
  const result = await listBranchStaff()

  // Filter to only teachers in this admin's branch
  const teachers = (result.success ? result.data ?? [] : []).filter(
    (a) => a.branch_id === branchId && a.role === "teacher"
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <UsersIcon className="size-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {TEACHER_MANAGEMENT_MESSAGES.PAGE_TITLE}
            </h2>
            <p className="text-sm text-muted-foreground">
              {TEACHER_MANAGEMENT_MESSAGES.PAGE_DESCRIPTION}
            </p>
          </div>
        </div>
        {branchResult.canManage && <GrantRoleDialog branchId={branchId} />}
      </div>

      {!result.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{TEACHER_MANAGEMENT_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {TEACHER_MANAGEMENT_MESSAGES.LOAD_FAILURE}
          </AlertDescription>
        </Alert>
      ) : (
        <StaffList assignments={teachers} branchId={branchId} />
      )}
    </div>
  )
}
