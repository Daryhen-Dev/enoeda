import type { ReactNode } from "react"

import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertCircleIcon, SettingsIcon } from "lucide-react"

import { BranchSelector } from "@/components/branch/branch-selector"
import { ClassPriceConfigDialog } from "@/components/payments/class-price-config-dialog"
import { DisciplineFilterTabs } from "@/components/payments/discipline-filter-tabs"
import { OverdueStudentsList } from "@/components/payments/overdue-students-list"
import { RecentPaymentActivityList } from "@/components/payments/recent-payment-activity-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import {
  listActiveDisciplinesForBranch,
} from "@/lib/domain/disciplines/actions"
import { disciplineIdSchema } from "@/lib/domain/disciplines/schema"
import {
  getMonthlyPaymentSummary,
  getOverdueStudents,
} from "@/lib/domain/payments/actions"
import type { MonthlyPaymentSummary } from "@/lib/domain/payments/queries"
import {
  OVERDUE_MESSAGES,
  PAYMENT_CONSOLE_MESSAGES,
  PAYMENT_MESSAGES,
  USER_LOCALE,
} from "@/lib/localization/es-ec"

const MONTH_FORMAT_OPTIONS = {
  month: "long",
  year: "numeric",
  timeZone: "America/Guayaquil",
} as const satisfies Intl.DateTimeFormatOptions

const USD_FORMAT_OPTIONS = {
  style: "currency",
  currency: PAYMENT_CONSOLE_MESSAGES.CURRENCY_CODE,
} as const satisfies Intl.NumberFormatOptions

const EMPTY_PAYMENT_SUMMARY = {
  totalMoneyCollected: 0,
  monthlyPaymentCount: 0,
  classPaymentCount: 0,
  overdueStudentCount: 0,
  recentActivity: [],
} as const satisfies MonthlyPaymentSummary

interface PaymentsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

interface MetricCardProps {
  label: string
  value: ReactNode
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OVERDUE_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>{OVERDUE_MESSAGES.NO_BRANCH_CONTEXT}</AlertDescription>
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
    redirect(`/dashboard/payments?${redirectParams.toString()}`)
  }

  if (branchResult.type === "selector") {
    const otherParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && typeof value === "string") {
        otherParams[key] = value
      }
    }
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/payments"
        currentParams={otherParams}
      />
    )
  }

  const disciplineParam = disciplineIdSchema.safeParse(params.discipline)
  const disciplinesResult = await listActiveDisciplinesForBranch({
    branch_id: branchResult.branchId,
  })
  const disciplines =
    disciplinesResult.success && disciplinesResult.data
      ? disciplinesResult.data
      : []
  const selectedDisciplineId =
    disciplineParam.success &&
    disciplines.some((discipline) => discipline.id === disciplineParam.data)
      ? disciplineParam.data
      : undefined
  const paymentFilter = selectedDisciplineId
    ? { branch_id: branchResult.branchId, discipline_id: selectedDisciplineId }
    : { branch_id: branchResult.branchId }
  const [summaryResult, overdueResult] = await Promise.all([
    getMonthlyPaymentSummary(paymentFilter),
    getOverdueStudents(paymentFilter),
  ])
  const summary =
    summaryResult.success && summaryResult.data
      ? summaryResult.data
      : EMPTY_PAYMENT_SUMMARY
  const overdueStudents =
    overdueResult.success && overdueResult.data ? overdueResult.data : []
  const currentMonth = new Intl.DateTimeFormat(
    USER_LOCALE,
    MONTH_FORMAT_OPTIONS
  ).format(new Date())
  const totalAmount = new Intl.NumberFormat(USER_LOCALE, USD_FORMAT_OPTIONS).format(
    summary.totalMoneyCollected
  )

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {PAYMENT_CONSOLE_MESSAGES.HEADING}
          </h1>
          <p className="text-sm text-muted-foreground">
            {PAYMENT_CONSOLE_MESSAGES.DESCRIPTION}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {PAYMENT_CONSOLE_MESSAGES.CURRENT_PERIOD}: {currentMonth}
          </p>
        </div>
        {branchResult.canManage && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/payments/settings?branch=${branchResult.branchId}`} />}>
            <SettingsIcon className="size-4" />
            {PAYMENT_MESSAGES.SETTINGS_LINK}
          </Button>
        )}
      </div>

      <DisciplineFilterTabs
        branchId={branchResult.branchId}
        disciplines={disciplines}
        selectedDisciplineId={selectedDisciplineId}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={PAYMENT_CONSOLE_MESSAGES.TOTAL_COLLECTED} value={totalAmount} />
        <MetricCard
          label={PAYMENT_CONSOLE_MESSAGES.MONTHLY_PAYMENT_COUNT}
          value={summary.monthlyPaymentCount}
        />
        <MetricCard
          label={PAYMENT_CONSOLE_MESSAGES.CLASS_PAYMENT_COUNT}
          value={summary.classPaymentCount}
        />
        <MetricCard
          label={PAYMENT_CONSOLE_MESSAGES.OVERDUE_COUNT}
          value={summary.overdueStudentCount}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {PAYMENT_CONSOLE_MESSAGES.REQUIRES_ACTION}
        </h2>
        <OverdueStudentsList
          students={overdueStudents}
          branchId={branchResult.branchId}
          canManage={branchResult.canManage}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {PAYMENT_CONSOLE_MESSAGES.RECENT_ACTIVITY}
        </h2>
        <RecentPaymentActivityList
          activity={summary.recentActivity}
          branchId={branchResult.branchId}
        />
      </section>

      {branchResult.canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {OVERDUE_MESSAGES.PRICING_SECTION_TITLE}
          </h2>
          <p className="text-sm text-muted-foreground">
            {OVERDUE_MESSAGES.PRICING_SECTION_DESCRIPTION}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {disciplines.map((discipline) => (
              <ClassPriceConfigDialog
                key={discipline.id}
                disciplineId={discipline.id}
                disciplineName={discipline.name}
                branchId={branchResult.branchId}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
