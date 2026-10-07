import Link from "next/link"

import {
  PaymentValidationInGraceTable,
  PaymentValidationSuspendedThisMonthTable,
  PaymentValidationUpToDateTable,
} from "@/components/payments/payment-validation-tables"
import { PaymentValidationSuspendTable } from "@/components/payments/payment-validation-suspend-table"
import {
  buildQuery,
  formatMonthName,
} from "@/components/payments/monthly-payment-validation-format"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getMonthlyPaymentValidation,
  type MonthlyPaymentValidationResult,
} from "@/lib/domain/payments/validation-actions"
import {
  PAYMENT_MESSAGES,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec"
import type { ReactNode } from "react"

const HEADING_ID = "monthly-payment-validation-heading"

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

interface MonthlyPaymentValidationViewProps {
  branchId: string
  timeZone: string
  headingLevel: "h1" | "h2"
  /** Loaded validation data, or null when the load failed. */
  validation: MonthlyPaymentValidationResult | null
  /** Server error message; null when the load succeeded. */
  error: string | null
}

/**
 * Pure presentational body of the monthly payment validation. Shared by the
 * standalone validation page (h1) and the overview page (h2).
 */
export function MonthlyPaymentValidationView({
  branchId,
  timeZone,
  headingLevel,
  validation,
  error,
}: MonthlyPaymentValidationViewProps) {
  if (validation === null || error !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}</AlertTitle>
        <AlertDescription>
          {error || PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE}
        </AlertDescription>
      </Alert>
    )
  }

  const HeadingTag = headingLevel
  const monthName = formatMonthName(validation.month)

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-6">
      <div>
        <HeadingTag
          id={HEADING_ID}
          className="text-2xl font-semibold tracking-tight"
        >
          {PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}
        </HeadingTag>
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
            timeZone={timeZone}
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
    </section>
  )
}

interface MonthlyPaymentValidationSectionProps {
  branchId: string
  timeZone: string
  /**
   * Heading level fitting the host page outline: "h1" on the standalone
   * validation page, "h2" on the overview page (which already has an h2
   * welcome heading).
   */
  headingLevel: "h1" | "h2"
}

/**
 * Self-loading monthly payment validation section. Owns the data fetch so it
 * can be mounted on any admin page; a failed load renders an inline
 * destructive alert instead of throwing, so host pages keep rendering.
 */
export default async function MonthlyPaymentValidationSection({
  branchId,
  timeZone,
  headingLevel,
}: MonthlyPaymentValidationSectionProps) {
  const validationResult = await getMonthlyPaymentValidation({
    branch_id: branchId,
  })

  if (!validationResult.success) {
    return (
      <MonthlyPaymentValidationView
        branchId={branchId}
        timeZone={timeZone}
        headingLevel={headingLevel}
        validation={null}
        error={validationResult.error}
      />
    )
  }

  return (
    <MonthlyPaymentValidationView
      branchId={branchId}
      timeZone={timeZone}
      headingLevel={headingLevel}
      validation={validationResult.data}
      error={null}
    />
  )
}
