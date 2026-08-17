import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertCircleIcon, UsersIcon, AlertTriangleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BranchSelector } from "@/components/branch/branch-selector"
import { getDashboardKpis } from "@/lib/domain/dashboard"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import {
  DASHBOARD_OVERVIEW_MESSAGES,
  formatNumber,
} from "@/lib/localization/es-ec"

interface DashboardOverviewProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function DashboardOverview({ searchParams }: DashboardOverviewProps) {
  const params = await searchParams

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{DASHBOARD_OVERVIEW_MESSAGES.WELCOME}</AlertTitle>
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

  if (branchResult.type === "selector") {
    const { branch: _, ...otherParams } = params
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard"
        currentParams={otherParams as Record<string, string>}
      />
    )
  }

  // Valid branch — proceed with KPI data
  const result = await getDashboardKpis(branchResult.branchId)
  const dashboard = result.success && result.data !== undefined ? result.data : null
  const activeStudentCountLabel =
    dashboard === null
      ? DASHBOARD_OVERVIEW_MESSAGES.UNAVAILABLE
      : formatNumber(dashboard.active_student_count)
  const inactiveStudentCountLabel =
    dashboard === null
      ? DASHBOARD_OVERVIEW_MESSAGES.UNAVAILABLE
      : formatNumber(dashboard.inactive_student_count)
  const overdueCountLabel =
    dashboard === null
      ? DASHBOARD_OVERVIEW_MESSAGES.UNAVAILABLE
      : formatNumber(dashboard.overdue_student_count)

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {DASHBOARD_OVERVIEW_MESSAGES.WELCOME}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dashboard !== null
            ? `${dashboard.branch_name} — ${DASHBOARD_OVERVIEW_MESSAGES.WORKSPACE_READY}`
            : DASHBOARD_OVERVIEW_MESSAGES.WORKSPACE_READY}
        </p>
      </div>

      {dashboard === null && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {DASHBOARD_OVERVIEW_MESSAGES.DATA_UNAVAILABLE_ALERT}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/students"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <UsersIcon className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    {DASHBOARD_OVERVIEW_MESSAGES.ACTIVE_STUDENTS}
                  </CardTitle>
                  <CardDescription>
                    {DASHBOARD_OVERVIEW_MESSAGES.ACTIVE_STUDENTS_DESCRIPTION}
                  </CardDescription>
                </div>
                <span
                  aria-label={DASHBOARD_OVERVIEW_MESSAGES.ACTIVE_STUDENT_COUNT_ARIA_LABEL(
                    activeStudentCountLabel,
                  )}
                  className="text-2xl font-semibold tabular-nums"
                >
                  {activeStudentCountLabel}
                </span>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <UsersIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle>
                  {DASHBOARD_OVERVIEW_MESSAGES.INACTIVE_STUDENTS}
                </CardTitle>
                <CardDescription>
                  {DASHBOARD_OVERVIEW_MESSAGES.INACTIVE_STUDENTS_DESCRIPTION}
                </CardDescription>
              </div>
              <span
                aria-label={DASHBOARD_OVERVIEW_MESSAGES.INACTIVE_STUDENT_COUNT_ARIA_LABEL(
                  inactiveStudentCountLabel,
                )}
                className="text-2xl font-semibold tabular-nums"
              >
                {inactiveStudentCountLabel}
              </span>
            </div>
          </CardHeader>
        </Card>

        <Link
          href="/dashboard/payments"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <AlertTriangleIcon className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    {DASHBOARD_OVERVIEW_MESSAGES.OVERDUE_STUDENTS}
                  </CardTitle>
                  <CardDescription>
                    {DASHBOARD_OVERVIEW_MESSAGES.OVERDUE_STUDENTS_DESCRIPTION}
                  </CardDescription>
                </div>
                <span
                  aria-label={DASHBOARD_OVERVIEW_MESSAGES.OVERDUE_STUDENT_COUNT_ARIA_LABEL(
                    overdueCountLabel,
                  )}
                  className="text-2xl font-semibold tabular-nums"
                >
                  {overdueCountLabel}
                </span>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
