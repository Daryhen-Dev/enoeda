"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { followUpMonthlyPayment } from "@/components/payments/monthly-payment-follow-up"
import { reactivateEnrollment } from "@/lib/domain/disciplines/actions"
import { registerMonthlyPayment } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  PAYMENT_FOLLOW_UP_MESSAGES,
  PAYMENT_MESSAGES,
  USER_LOCALE,
} from "@/lib/localization/es-ec"

const MONTH_VALUES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const

const PAYMENT_MODES = {
  EASY: "easy",
  ADVANCED: "advanced",
} as const

type PaymentMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES]

/** "YYYY-MM" as produced by the domain (`next_due_date` is a date-only string). */
const SUGGESTED_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

const MAX_COVERAGE_MONTHS = 24

interface MonthSelection {
  year: string
  month: string
}

interface RegisterMonthlyPaymentDialogProps {
  studentDisciplineId: string
  branchId: string
  /** Trigger button variant; "outline" preserves the default appearance. */
  triggerVariant?: "default" | "outline"
  /** Accessible name for the trigger, e.g. one that names the discipline. */
  triggerAriaLabel?: string
  /** Controlled open state; the built-in trigger keeps working when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Do not render the trigger button (the caller opens the sheet itself). */
  hideTrigger?: boolean
  /**
   * The enrollment is suspended for non-payment: the same submit pays and
   * reactivates it, and the trigger names both steps.
   */
  suspended?: boolean
  /**
   * First unpaid month as "YYYY-MM"; easy mode starts here instead of on the
   * current month. Anything else falls back to the current month.
   */
  suggestedMonth?: string
}

function getLocalDateInputValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${date.getFullYear()}-${month}-${day}`
}

function getCurrentYearValue() {
  return String(new Date().getFullYear())
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(USER_LOCALE, { month: "long" }).format(
    new Date(2024, Number(value) - 1, 1)
  )
}

/** First day of the month AFTER `lastMonth` (December rolls into January). */
function getPeriodEnd(year: string, lastMonth: string) {
  const month = Number(lastMonth)
  const endYear = month === 12 ? Number(year) + 1 : Number(year)
  const endMonth = month === 12 ? 1 : month + 1

  return `${endYear}-${String(endMonth).padStart(2, "0")}-01`
}

function getCoverageMonthCount(
  startYear: string,
  startMonth: string,
  endYear: string,
  endMonth: string
): number {
  if (!startYear || !startMonth || !endYear || !endMonth) return 0
  return (Number(endYear) - Number(startYear)) * 12 + Number(endMonth) - Number(startMonth) + 1
}

/** The month easy mode opens on: the suggested one, else the current month. */
function getDefaultMonth(suggestedMonth?: string): MonthSelection {
  const match = SUGGESTED_MONTH_PATTERN.exec(suggestedMonth ?? "")
  if (match) return { year: match[1], month: match[2] }

  const now = new Date()
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
  }
}

/** The visible years, plus whatever year the form is already anchored on. */
function getCalendarYears(...anchors: string[]): number[] {
  const currentYear = Number(getCurrentYearValue())
  const years = new Set([
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ])
  for (const anchor of anchors) {
    const year = Number(anchor)
    if (year > 0) years.add(year)
  }

  return [...years].sort((a, b) => a - b)
}

export function RegisterMonthlyPaymentDialog({
  studentDisciplineId,
  branchId,
  triggerVariant = "outline",
  triggerAriaLabel,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  suspended = false,
  suggestedMonth,
}: RegisterMonthlyPaymentDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen
  const [mode, setMode] = useState<PaymentMode>(PAYMENT_MODES.EASY)
  // Easy mode: exactly one month, so one month + one year selection.
  const [singleMonth, setSingleMonth] = useState<MonthSelection>(() =>
    getDefaultMonth(suggestedMonth)
  )
  // Advanced mode: the first/last month range.
  const [startYear, setStartYear] = useState(getCurrentYearValue)
  const [startMonth, setStartMonth] = useState("")
  const [endYear, setEndYear] = useState(getCurrentYearValue)
  const [endMonth, setEndMonth] = useState("")
  const [rangeInteracted, setRangeInteracted] = useState(false)
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(getLocalDateInputValue)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEasyMode = mode === PAYMENT_MODES.EASY
  const coverageMonthCount = getCoverageMonthCount(startYear, startMonth, endYear, endMonth)
  const isMonthRangeInvalid =
    coverageMonthCount < 1 || coverageMonthCount > MAX_COVERAGE_MONTHS
  // A range only counts as wrong once the admin touched it or tried to submit:
  // a freshly opened form shows the prefilled range, never a red border.
  const showRangeError = rangeInteracted && isMonthRangeInvalid
  const hasAmount = Number(amount) > 0
  const calendarYears = getCalendarYears(singleMonth.year, startYear, endYear)

  function resetForm() {
    setMode(PAYMENT_MODES.EASY)
    setSingleMonth(getDefaultMonth(suggestedMonth))
    setStartYear(getCurrentYearValue())
    setStartMonth("")
    setEndYear(getCurrentYearValue())
    setEndMonth("")
    setRangeInteracted(false)
    setAmount("")
    setPaymentDate(getLocalDateInputValue())
    setNote("")
    setError(null)
  }

  function requestOpenChange(nextOpen: boolean) {
    if (isControlled) {
      onOpenChange?.(nextOpen)
      return
    }

    setInternalOpen(nextOpen)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return

    requestOpenChange(nextOpen)
    resetForm()
  }

  /** Easy -> advanced: the single month becomes the first and last month. */
  function showAdvancedMode() {
    setStartYear(singleMonth.year)
    setStartMonth(singleMonth.month)
    setEndYear(singleMonth.year)
    setEndMonth(singleMonth.month)
    setRangeInteracted(false)
    setError(null)
    setMode(PAYMENT_MODES.ADVANCED)
  }

  /** Advanced -> easy: the first month of the range becomes the paid month. */
  function showEasyMode() {
    setSingleMonth((current) => ({
      year: startYear || current.year,
      month: startMonth || current.month,
    }))
    setError(null)
    setMode(PAYMENT_MODES.EASY)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasAmount) return

    let periodStart: string
    let periodEnd: string

    if (isEasyMode) {
      if (!singleMonth.year || !singleMonth.month) return
      periodStart = `${singleMonth.year}-${singleMonth.month}-01`
      periodEnd = getPeriodEnd(singleMonth.year, singleMonth.month)
    } else {
      setRangeInteracted(true)
      if (!startYear || !startMonth || !endYear || !endMonth || isMonthRangeInvalid) {
        return
      }
      periodStart = `${startYear}-${startMonth}-01`
      periodEnd = getPeriodEnd(endYear, endMonth)
    }

    startTransition(async () => {
      const result = await registerMonthlyPayment({
        student_discipline_id: studentDisciplineId,
        amount: Number(amount),
        period_start: periodStart,
        period_end: periodEnd,
        payment_date: paymentDate || undefined,
        note: note || undefined,
        branch_id: branchId,
      })
      if (!result.success) {
        // Nothing was charged: keep the form open so the admin can fix it.
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      // The payment is committed from here on. Close the form before any
      // follow-up so a failed reactivation can never invite a second charge.
      requestOpenChange(false)
      resetForm()

      const outcome = await followUpMonthlyPayment({
        nextDueDate: result.data.next_due_date,
        reactivate: suspended
          ? () =>
              reactivateEnrollment({
                student_discipline_id: studentDisciplineId,
                branch_id: branchId,
              })
          : undefined,
      })

      if (outcome.tone === "success") {
        toast.success(outcome.title, { description: outcome.description })
      } else {
        toast.warning(outcome.title, { description: outcome.description })
      }
      router.refresh()
    })
  }

  const canSubmit = isEasyMode
    ? hasAmount && Boolean(singleMonth.year && singleMonth.month)
    : hasAmount &&
      Boolean(startYear && startMonth && endYear && endMonth) &&
      !isMonthRangeInvalid

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <SheetTrigger
          render={
            <Button
              variant={triggerVariant}
              size="sm"
              aria-label={triggerAriaLabel}
            />
          }
        >
          <PlusIcon className="size-4" />
          {suspended
            ? PAYMENT_FOLLOW_UP_MESSAGES.PAY_AND_REACTIVATE
            : PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}
        </SheetTrigger>
      )}
      <SheetContent side="right" size="content" showCloseButton={!isPending}>
        <SheetHeader>
          <SheetTitle>{PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}</SheetTitle>
          <SheetDescription>
            {PAYMENT_MESSAGES.REGISTER_MONTHLY_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pay-amount">
                {PAYMENT_MESSAGES.AMOUNT_LABEL}
              </FieldLabel>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </Field>

            {isEasyMode ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="pay-month">
                      {PAYMENT_MESSAGES.PAYMENT_MONTH_LABEL}
                    </FieldLabel>
                    <Select
                      value={singleMonth.month}
                      onValueChange={(value) =>
                        setSingleMonth((current) => ({
                          ...current,
                          month: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger id="pay-month" className="w-full">
                        <span data-slot="select-value" className="min-w-0 flex-1 truncate text-left">
                          {singleMonth.month
                            ? formatMonth(singleMonth.month)
                            : PAYMENT_MESSAGES.PAYMENT_MONTH_LABEL}
                        </span>
                      </SelectTrigger>
                      <SelectContent>{MONTH_VALUES.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pay-month-year">
                      {PAYMENT_MESSAGES.CALENDAR_YEAR_LABEL}
                    </FieldLabel>
                    <Select
                      value={singleMonth.year}
                      onValueChange={(value) =>
                        setSingleMonth((current) => ({
                          ...current,
                          year: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger id="pay-month-year" className="w-full">
                        <SelectValue className="min-w-0" />
                      </SelectTrigger>
                      <SelectContent>{calendarYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {PAYMENT_MESSAGES.COVERAGE_MONTH_COUNT(1)}
                </p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="pay-start-year">
                      {PAYMENT_MESSAGES.CALENDAR_YEAR_LABEL} inicial
                    </FieldLabel>
                    <Select value={startYear} onValueChange={(value) => setStartYear(value ?? "")}>
                      <SelectTrigger id="pay-start-year" className="w-full"><SelectValue className="min-w-0" /></SelectTrigger>
                      <SelectContent>{calendarYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pay-first-month">{PAYMENT_MESSAGES.FIRST_MONTH_LABEL}</FieldLabel>
                    <Select value={startMonth} onValueChange={(value) => {
                      setStartMonth(value ?? "")
                      setRangeInteracted(true)
                    }}>
                      <SelectTrigger id="pay-first-month" className="w-full" aria-invalid={showRangeError || undefined}>
                        <span data-slot="select-value" className="min-w-0 flex-1 truncate text-left">
                          {startMonth
                            ? formatMonth(startMonth)
                            : PAYMENT_MESSAGES.FIRST_MONTH_LABEL}
                        </span>
                      </SelectTrigger>
                      <SelectContent>{MONTH_VALUES.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pay-end-year">
                      {PAYMENT_MESSAGES.CALENDAR_YEAR_LABEL} final
                    </FieldLabel>
                    <Select value={endYear} onValueChange={(value) => setEndYear(value ?? "")}>
                      <SelectTrigger id="pay-end-year" className="w-full"><SelectValue className="min-w-0" /></SelectTrigger>
                      <SelectContent>{calendarYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pay-last-month">{PAYMENT_MESSAGES.LAST_MONTH_LABEL}</FieldLabel>
                    <Select value={endMonth} onValueChange={(value) => {
                      setEndMonth(value ?? "")
                      setRangeInteracted(true)
                    }}>
                      <SelectTrigger id="pay-last-month" className="w-full" aria-invalid={showRangeError || undefined} aria-describedby="pay-month-range-error">
                        <span data-slot="select-value" className="min-w-0 flex-1 truncate text-left">
                          {endMonth
                            ? formatMonth(endMonth)
                            : PAYMENT_MESSAGES.LAST_MONTH_LABEL}
                        </span>
                      </SelectTrigger>
                      <SelectContent>{MONTH_VALUES.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                {coverageMonthCount > 0 && !isMonthRangeInvalid && (
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {PAYMENT_MESSAGES.COVERAGE_MONTH_COUNT(coverageMonthCount)}
                  </p>
                )}
                {showRangeError && (
                  <FieldError id="pay-month-range-error">
                    {coverageMonthCount < 1
                      ? PAYMENT_MESSAGES.MONTH_RANGE_INVALID
                      : PAYMENT_MESSAGES.PERIOD_MAX_24_MONTHS}
                  </FieldError>
                )}
              </>
            )}

            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto self-start px-0"
              onClick={isEasyMode ? showAdvancedMode : showEasyMode}
            >
              {isEasyMode
                ? PAYMENT_MESSAGES.PAY_MULTIPLE_MONTHS_ACTION
                : PAYMENT_MESSAGES.PAY_SINGLE_MONTH_ACTION}
            </Button>

            <Field>
              <FieldLabel htmlFor="pay-date">
                {PAYMENT_MESSAGES.PAYMENT_DATE_LABEL}
              </FieldLabel>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="pay-note">
                {PAYMENT_MESSAGES.NOTE_LABEL}
              </FieldLabel>
              <Input
                id="pay-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={PAYMENT_MESSAGES.NOTE_PLACEHOLDER}
                maxLength={500}
              />
            </Field>

            {error && <FieldError id="pay-payment-error">{error}</FieldError>}
          </FieldGroup>

          <SheetFooter className="-mx-4">
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              {COMMON_MESSAGES.CANCEL}
            </SheetClose>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending
                ? PAYMENT_MESSAGES.SAVING
                : suspended
                  ? PAYMENT_FOLLOW_UP_MESSAGES.PAY_AND_REACTIVATE
                  : PAYMENT_MESSAGES.REGISTER_ACTION}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
