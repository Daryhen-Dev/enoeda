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
import { registerMonthlyPayment } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  PAYMENT_MESSAGES,
  TOAST_MESSAGES,
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

interface RegisterMonthlyPaymentDialogProps {
  studentDisciplineId: string
  branchId: string
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

export function RegisterMonthlyPaymentDialog({
  studentDisciplineId,
  branchId,
}: RegisterMonthlyPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [startYear, setStartYear] = useState(getCurrentYearValue)
  const [startMonth, setStartMonth] = useState("")
  const [endYear, setEndYear] = useState(getCurrentYearValue)
  const [endMonth, setEndMonth] = useState("")
  const [paymentDate, setPaymentDate] = useState(getLocalDateInputValue)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const coverageMonthCount = getCoverageMonthCount(startYear, startMonth, endYear, endMonth)
  const isMonthRangeInvalid = coverageMonthCount < 1 || coverageMonthCount > 24
  const currentYear = Number(getCurrentYearValue())
  const calendarYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  function resetForm() {
    setAmount("")
    setStartYear(getCurrentYearValue())
    setStartMonth("")
    setEndYear(getCurrentYearValue())
    setEndMonth("")
    setPaymentDate(getLocalDateInputValue())
    setNote("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !amount ||
      !startYear ||
      !startMonth ||
      !endYear ||
      !endMonth ||
      isMonthRangeInvalid
    ) {
      return
    }

    const periodStart = `${startYear}-${startMonth}-01`
    const periodEnd = getPeriodEnd(endYear, endMonth)

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
      if (result.success) {
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.MONTHLY_PAYMENT_REGISTERED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return

        setOpen(nextOpen)
        resetForm()
      }}
    >
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        {PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}
      </SheetTrigger>
      <SheetContent side="right" size="content" showCloseButton={!isPending}>
        <SheetHeader>
          <SheetTitle>{PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}</SheetTitle>
          <SheetDescription>
            {PAYMENT_MESSAGES.REGISTER_MONTHLY_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="pay-start-year">
                  {PAYMENT_MESSAGES.CALENDAR_YEAR_LABEL} inicial
                </FieldLabel>
                <Select value={startYear} onValueChange={(value) => setStartYear(value ?? "")}>
                  <SelectTrigger id="pay-start-year"><SelectValue /></SelectTrigger>
                  <SelectContent>{calendarYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-first-month">{PAYMENT_MESSAGES.FIRST_MONTH_LABEL}</FieldLabel>
                <Select value={startMonth} onValueChange={(value) => setStartMonth(value ?? "")}>
                  <SelectTrigger id="pay-first-month" aria-invalid={isMonthRangeInvalid}><SelectValue placeholder={PAYMENT_MESSAGES.FIRST_MONTH_LABEL} /></SelectTrigger>
                  <SelectContent>{MONTH_VALUES.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-end-year">
                  {PAYMENT_MESSAGES.CALENDAR_YEAR_LABEL} final
                </FieldLabel>
                <Select value={endYear} onValueChange={(value) => setEndYear(value ?? "")}>
                  <SelectTrigger id="pay-end-year"><SelectValue /></SelectTrigger>
                  <SelectContent>{calendarYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-last-month">{PAYMENT_MESSAGES.LAST_MONTH_LABEL}</FieldLabel>
                <Select value={endMonth} onValueChange={(value) => setEndMonth(value ?? "")}>
                  <SelectTrigger id="pay-last-month" aria-invalid={isMonthRangeInvalid} aria-describedby="pay-month-range-error"><SelectValue placeholder={PAYMENT_MESSAGES.LAST_MONTH_LABEL} /></SelectTrigger>
                  <SelectContent>{MONTH_VALUES.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            {coverageMonthCount > 0 && !isMonthRangeInvalid && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {PAYMENT_MESSAGES.COVERAGE_MONTH_COUNT(coverageMonthCount)}
              </p>
            )}
            {isMonthRangeInvalid && startMonth && endMonth && (
              <FieldError id="pay-month-range-error">
                {coverageMonthCount < 1
                  ? PAYMENT_MESSAGES.MONTH_RANGE_INVALID
                  : PAYMENT_MESSAGES.PERIOD_MAX_24_MONTHS}
              </FieldError>
            )}

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

          <SheetFooter>
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              {COMMON_MESSAGES.CANCEL}
            </SheetClose>
            <Button
              type="submit"
              disabled={
                isPending ||
                !amount ||
                !startYear ||
                !startMonth ||
                !endYear ||
                !endMonth ||
                isMonthRangeInvalid
              }
            >
              {isPending
                ? PAYMENT_MESSAGES.SAVING
                : PAYMENT_MESSAGES.REGISTER_ACTION}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
