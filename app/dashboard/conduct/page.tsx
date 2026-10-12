import { redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConductQuickEntry } from "@/components/conduct/conduct-quick-entry"
import { RecentConductRecords } from "@/components/conduct/recent-conduct-records"
import { listRecentBranchConductRecords } from "@/lib/domain/conduct"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { getCurrentDateOnly } from "@/lib/date"
import { CONDUCT_QUICK_ENTRY_MESSAGES } from "@/lib/localization/es-ec"

interface ConductPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function ConductPage({ searchParams }: ConductPageProps) {
  const params = await searchParams

  // Page-level branch context resolution (never in layout). Same scope as the
  // students directory: only branches where the caller is admin or teacher.
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{CONDUCT_QUICK_ENTRY_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {CONDUCT_QUICK_ENTRY_MESSAGES.LOAD_FAILURE_TITLE}
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
    redirect(`/dashboard/conduct?${redirectParams.toString()}`)
  }

  const branchId = branchResult.branchId
  // Admin or teacher of the branch.
  const canWriteConduct = branchResult.canWriteConduct
  const todayDateOnly = getCurrentDateOnly(branchResult.timeZone)

  const recentResult = await listRecentBranchConductRecords({
    branch_id: branchId,
  })
  const records =
    recentResult.success && recentResult.data
      ? recentResult.data.records
      : []
  const recentError = recentResult.success
    ? undefined
    : CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_LOAD_FAILURE

  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {CONDUCT_QUICK_ENTRY_MESSAGES.PAGE_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {CONDUCT_QUICK_ENTRY_MESSAGES.PAGE_DESCRIPTION}
        </p>
      </header>

      {canWriteConduct && (
        <ConductQuickEntry branchId={branchId} todayDateOnly={todayDateOnly} />
      )}

      <RecentConductRecords
        records={records}
        branchId={branchId}
        initialError={recentError}
      />
    </main>
  )
}
