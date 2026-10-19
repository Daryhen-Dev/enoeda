import Link from "next/link"

import {
  getMonthlyPaymentValidation,
  type MonthlyPaymentValidationResult,
  type MonthlyPaymentValidationRow,
} from "@/lib/domain/payments/validation-actions"
import {
  DASHBOARD_OVERVIEW_MESSAGES,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec"

const HEADING_ID = "payments-action-heading"
const MAX_ROWS_PER_GROUP = 5

/** Formats a date-only string (es-EC long month) anchored to UTC so the
 * rendered calendar day never shifts with the server time zone. */
function formatDateOnlyEsEC(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)))
}

interface PaymentGroupProps {
  label: string
  count: number
  /** Destructive carmine marks the to-suspend group count only. */
  tone?: "default" | "destructive"
  rows: MonthlyPaymentValidationRow[]
  emptyText: string
  showGraceDeadline?: boolean
}

function PaymentGroup({
  label,
  count,
  tone = "default",
  rows,
  emptyText,
  showGraceDeadline = false,
}: PaymentGroupProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 px-4 py-2.5 md:px-5">
        <h4 className="text-sm font-semibold">{label}</h4>
        <span
          className={`text-sm font-medium tabular-nums ${
            tone === "destructive" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {count}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="border-b border-border px-4 pb-3 text-sm text-muted-foreground md:px-5">
          {emptyText}
        </p>
      ) : (
        <ul aria-label={label}>
          {rows.map((row) => (
            <li
              key={row.student_discipline_id}
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 md:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.student_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.discipline_name}
                  {showGraceDeadline && row.grace_deadline &&
                    ` · ${PAYMENT_VALIDATION_MESSAGES.GRACE_DEADLINE}: ${formatDateOnlyEsEC(row.grace_deadline)}`}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">
                {DASHBOARD_OVERVIEW_MESSAGES.DAYS_OVERDUE_COUNT(row.days_overdue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface PaymentsActionPanelProps {
  branchId: string
  validation: MonthlyPaymentValidationResult | null
  /** Server error message; null when the validation loaded. */
  error: string | null
}

/**
 * Work area (B) of the dashboard overview: the enrollments that need a
 * decision, as ruled ledger lines — "A suspender" first (destructive
 * carmine count, never the seal vermilion), then "En período de gracia".
 * Shows at most five rows per group; the full table stays on the
 * validation page, linked from the footer.
 */
export function PaymentsActionPanel({
  branchId,
  validation,
  error,
}: PaymentsActionPanelProps) {
  const validationHref = `/dashboard/payments/validation?branch=${encodeURIComponent(branchId)}`

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3 md:px-5">
        <h3 id={HEADING_ID} className="text-base font-semibold">
          {DASHBOARD_OVERVIEW_MESSAGES.PAYMENTS_ACTION_TITLE}
        </h3>
      </div>

      {error !== null || validation === null ? (
        <p
          role="alert"
          className="mx-4 my-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive md:mx-5"
        >
          {error ?? PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE}
        </p>
      ) : (
        <>
          <PaymentGroup
            label={PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND}
            count={validation.to_suspend.length}
            tone="destructive"
            rows={validation.to_suspend.slice(0, MAX_ROWS_PER_GROUP)}
            emptyText={PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND_EMPTY}
          />
          <PaymentGroup
            label={PAYMENT_VALIDATION_MESSAGES.IN_GRACE}
            count={validation.in_grace.length}
            rows={validation.in_grace.slice(0, MAX_ROWS_PER_GROUP)}
            emptyText={PAYMENT_VALIDATION_MESSAGES.IN_GRACE_EMPTY}
            showGraceDeadline
          />
        </>
      )}

      <div className="px-4 py-2.5 md:px-5">
        <Link
          href={validationHref}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {DASHBOARD_OVERVIEW_MESSAGES.VALIDATION_LINK}
        </Link>
      </div>
    </section>
  )
}

/**
 * Async server child streamed under its own Suspense boundary so the agenda
 * renders before the (heavier) payment validation query resolves.
 */
export async function PaymentsActionPanelSection({
  branchId,
}: {
  branchId: string
}) {
  const result = await getMonthlyPaymentValidation({ branch_id: branchId })
  const validation = result.success ? result.data : null

  return (
    <PaymentsActionPanel
      branchId={branchId}
      validation={validation}
      error={
        result.success
          ? null
          : (result.error ?? PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE)
      }
    />
  )
}
