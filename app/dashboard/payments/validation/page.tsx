import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import {
  PaymentValidationInGraceTable,
  PaymentValidationSuspendedThisMonthTable,
  PaymentValidationUpToDateTable,
} from "@/components/payments/payment-validation-tables"
import { PaymentValidationSuspendTable } from "@/components/payments/payment-validation-suspend-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { getMonthlyPaymentValidation } from "@/lib/domain/payments/validation-actions"
import {
  PAYMENT_MESSAGES,
  PAYMENT_VALIDATION_MESSAGES,
  USER_LOCALE,
} from "@/lib/localization/es-ec"

const MONTH_FORMAT_OPTIONS = {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions

interface ValidationPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

interface ValidationMetricCardProps {
  label: string
  value: ReactNode
}

function ValidationMetricCard({ label, value }: ValidationMetricCardProps) {
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

/**
 * Formats the branch-local month ("YYYY-MM") as "month year" in es-EC. The
 * parts are interpreted as UTC so the month name never shifts with the
 * server's local time zone.
 */
function formatMonthName(month: string): string {
  const [year, monthPart] = month.split("-").map(Number)
  return new Intl.DateTimeFormat(USER_LOCALE, MONTH_FORMAT_OPTIONS).format(
    new Date(Date.UTC(year, monthPart - 1, 15))
  )
}

function buildQuery(branchId: string): string {
  return new URLSearchParams({ branch: branchId }).toString()
}

export default async function PaymentValidationPage({
  searchParams,
}: ValidationPageProps) {
  const params = await searchParams
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/payments/validation?${redirectParams.toString()}`)
  }

  if (branchResult.type === "error" || !branchResult.canManage) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {PAYMENT_VALIDATION_MESSAGES.NOT_AUTHORIZED}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const branchId = branchResult.branchId
  const validationResult = await getMonthlyPaymentValidation({
    branch_id: branchId,
  })
  const validationError = validationResult.success
    ? null
    : validationResult.error

  if (!validationResult.success || !validationResult.data) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {validationError ?? PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const validation = validationResult.data
  const monthName = formatMonthName(validation.month)

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <Link
          href={`/dashboard/payments?${buildQuery(branchId)}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {PAYMENT_VALIDATION_MESSAGES.BACK_LINK}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {PAYMENT_VALIDATION_MESSAGES.PAGE_DESCRIPTION(monthName)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {PAYMENT_MESSAGES.GRACE_DAYS_LABEL}:{" "}
          <Link
            href={`/dashboard/payments/settings?${buildQuery(branchId)}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {validation.grace_days}
          </Link>
        </p>
      </div>

      <section
        aria-label={PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <ValidationMetricCard
          label={PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE}
          value={validation.up_to_date.length}
        />
        <ValidationMetricCard
          label={PAYMENT_VALIDATION_MESSAGES.IN_GRACE}
          value={validation.in_grace.length}
        />
        <ValidationMetricCard
          label={PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND}
          value={validation.to_suspend.length}
        />
        <ValidationMetricCard
          label={PAYMENT_VALIDATION_MESSAGES.SUSPENDED_THIS_MONTH}
          value={validation.suspended_this_month.length}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentValidationSuspendTable
            rows={validation.to_suspend}
            branchId={branchId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{PAYMENT_VALIDATION_MESSAGES.IN_GRACE}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentValidationInGraceTable
            rows={validation.in_grace}
            branchId={branchId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {PAYMENT_VALIDATION_MESSAGES.SUSPENDED_THIS_MONTH}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentValidationSuspendedThisMonthTable
            rows={validation.suspended_this_month}
            branchId={branchId}
            timeZone={branchResult.timeZone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentValidationUpToDateTable
            rows={validation.up_to_date}
            branchId={branchId}
          />
        </CardContent>
      </Card>
    </main>
  )
}
