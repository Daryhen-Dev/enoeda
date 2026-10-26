import { Suspense } from "react"

import { redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { OverviewQuickActions } from "@/components/dashboard/overview-quick-actions"
import { PaymentsActionPanelSection } from "@/components/dashboard/payments-action-panel"
import { TodayAgendaPanel } from "@/components/dashboard/today-agenda-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { getCurrentDateOnly } from "@/lib/date"
import { getSessionsForRange } from "@/lib/domain/classes/actions"
import { buildTodayAgenda, formatOverviewDate } from "@/lib/domain/dashboard"
import {
  CALENDAR_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
  DASHBOARD_SHELL_MESSAGES,
} from "@/lib/localization/es-ec"

interface DashboardOverviewProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

/** Ledger summary line: "3 clases · 1 con asistencia registrada · 2 pendientes". */
function buildSummaryLine(agenda: ReturnType<typeof buildTodayAgenda>): string | null {
  const { total, sealed, pending, suspended } = agenda.counts
  if (total === 0) return null

  return [
    DASHBOARD_OVERVIEW_MESSAGES.SUMMARY_CLASSES(total),
    sealed > 0 && DASHBOARD_OVERVIEW_MESSAGES.SUMMARY_SEALED(sealed),
    pending > 0 && DASHBOARD_OVERVIEW_MESSAGES.SUMMARY_PENDING(pending),
    suspended > 0 && DASHBOARD_OVERVIEW_MESSAGES.SUMMARY_SUSPENDED(suspended),
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Placeholder for the streamed payments panel: a skeleton ledger panel. */
function PaymentsActionPanelFallback() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3 md:px-5">
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="flex flex-col gap-4 px-4 py-3 md:px-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function DashboardOverview({
  searchParams,
}: DashboardOverviewProps) {
  const params = await searchParams

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{DASHBOARD_SHELL_MESSAGES.OVERVIEW}</AlertTitle>
          <AlertDescription>
            {DASHBOARD_OVERVIEW_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard?${redirectParams.toString()}`)
  }

  const timeZone = branchResult.timeZone
  const today = getCurrentDateOnly(timeZone)

  const sessionsResult = await getSessionsForRange({
    branch_id: branchResult.branchId,
    start_date: today,
    end_date: today,
  })
  const sessions =
    sessionsResult.success && sessionsResult.data !== undefined
      ? sessionsResult.data
      : null
  const agenda = buildTodayAgenda(sessions ?? [])
  const summaryLine = buildSummaryLine(agenda)

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">
            {CALENDAR_MESSAGES.TODAY}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatOverviewDate(today)}
          </p>
        </div>
        {summaryLine !== null && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {summaryLine}
          </p>
        )}
      </header>

      {branchResult.canWriteConduct && (
        <OverviewQuickActions branchId={branchResult.branchId} />
      )}

      <div className="grid gap-4 xl:grid-cols-12 xl:gap-6">
        <div className={`min-w-0 ${branchResult.canManage ? "xl:col-span-7" : "xl:col-span-12"}`}>
          <TodayAgendaPanel
            sessions={sessions ?? []}
            branchId={branchResult.branchId}
            loadError={
              sessions === null ? CALENDAR_MESSAGES.LOAD_FAILURE : null
            }
          />
        </div>

        {branchResult.canManage && (
          <div className="min-w-0 xl:col-span-5">
            <Suspense fallback={<PaymentsActionPanelFallback />}>
              <PaymentsActionPanelSection branchId={branchResult.branchId} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
