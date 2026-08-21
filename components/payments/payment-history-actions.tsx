"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  correctClassPayment,
  correctMonthlyPayment,
  deleteClassPayment,
  deleteMonthlyPayment,
} from "@/lib/domain/payments/actions"
import { formatDatabaseDateOnly } from "@/lib/date"
import {
  getMonthlyPaymentPeriod,
  getPreviousPaymentMonth,
  isPaymentCorrectionWithinWindow,
} from "@/lib/domain/payments/reconciliation"
import { COMMON_MESSAGES, PAYMENT_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

export const PAYMENT_HISTORY_KIND = {
  MONTHLY: "monthly",
  CLASS: "class",
} as const

type PaymentHistoryKind = (typeof PAYMENT_HISTORY_KIND)[keyof typeof PAYMENT_HISTORY_KIND]
type MonthlyPeriodErrorCode = NonNullable<ReturnType<typeof getMonthlyPaymentPeriod>["error"]>

const MONTHLY_PERIOD_ERROR_MESSAGES = {
  invalid_month: PAYMENT_MESSAGES.INVALID_DATE,
  end_before_start: PAYMENT_MESSAGES.MONTH_RANGE_INVALID,
  duration_exceeds_max: PAYMENT_MESSAGES.PERIOD_MAX_24_MONTHS,
} satisfies Record<MonthlyPeriodErrorCode, string>

function getMonthlyPeriodErrorMessage(error: MonthlyPeriodErrorCode): string {
  return MONTHLY_PERIOD_ERROR_MESSAGES[error]
}

export interface PaymentHistoryActionRecord {
  id: string
  kind: PaymentHistoryKind
  amount: number
  payment_date: Date
  class_date: Date
  period_start: Date
  period_end: Date
  created_at: Date
  note: string | null
}

interface PaymentHistoryActionsProps {
  record: PaymentHistoryActionRecord
  branchId: string
  canManage: boolean
  paymentSettingsAvailable: boolean
  paymentEditWindowDays: number | null
}

export function PaymentHistoryActions({
  record,
  branchId,
  canManage,
  paymentSettingsAvailable,
  paymentEditWindowDays,
}: PaymentHistoryActionsProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [amount, setAmount] = useState(String(record.amount))
  const [paymentDate, setPaymentDate] = useState(formatDatabaseDateOnly(record.payment_date))
  const [classDate, setClassDate] = useState(formatDatabaseDateOnly(record.class_date))
  const [periodStart, setPeriodStart] = useState(formatDatabaseDateOnly(record.period_start).slice(0, 7))
  const [periodEnd, setPeriodEnd] = useState(getPreviousPaymentMonth(formatDatabaseDateOnly(record.period_end).slice(0, 7)))
  const [note, setNote] = useState(record.note ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!canManage) {
    return <span className="text-xs text-muted-foreground">{PAYMENT_MESSAGES.LOCKED_REASON}</span>
  }

  if (!paymentSettingsAvailable || paymentEditWindowDays === null) {
    return <span className="text-xs text-muted-foreground">{PAYMENT_MESSAGES.SETTINGS_UNAVAILABLE}</span>
  }

  if (!isPaymentCorrectionWithinWindow(record.created_at, paymentEditWindowDays, new Date())) {
    return <span className="text-xs text-muted-foreground">{PAYMENT_MESSAGES.CORRECTION_WINDOW_EXCEEDED}</span>
  }

  function reset() {
    setAmount(String(record.amount))
    setPaymentDate(formatDatabaseDateOnly(record.payment_date))
    setClassDate(formatDatabaseDateOnly(record.class_date))
    setPeriodStart(formatDatabaseDateOnly(record.period_start).slice(0, 7))
    setPeriodEnd(getPreviousPaymentMonth(formatDatabaseDateOnly(record.period_end).slice(0, 7)))
    setNote(record.note ?? "")
    setError(null)
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const monthlyPeriod = record.kind === PAYMENT_HISTORY_KIND.MONTHLY
      ? getMonthlyPaymentPeriod(periodStart, periodEnd)
      : null
    if (monthlyPeriod && !monthlyPeriod.period) {
      setError(monthlyPeriod.error ? getMonthlyPeriodErrorMessage(monthlyPeriod.error) : COMMON_MESSAGES.UNEXPECTED_ERROR)
      return
    }

    startTransition(async () => {
      const result = record.kind === PAYMENT_HISTORY_KIND.MONTHLY
        ? await correctMonthlyPayment({
            id: record.id,
            amount: Number(amount),
            period_start: monthlyPeriod!.period!.period_start,
            period_end: monthlyPeriod!.period!.period_end,
            payment_date: paymentDate,
            note: note || undefined,
            branch_id: branchId,
          })
        : await correctClassPayment({
            id: record.id,
            amount: Number(amount),
            class_date: classDate,
            branch_id: branchId,
          })
      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }
      setEditing(false)
      toast.success(TOAST_MESSAGES.PAYMENT_CORRECTED)
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = record.kind === PAYMENT_HISTORY_KIND.MONTHLY
        ? await deleteMonthlyPayment({ id: record.id, branch_id: branchId })
        : await deleteClassPayment({ id: record.id, branch_id: branchId })
      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }
      setDeleting(false)
      toast.success(TOAST_MESSAGES.PAYMENT_DELETED)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" aria-label={PAYMENT_MESSAGES.EDIT_ACTION} onClick={() => setEditing(true)}>
        <PencilIcon className="size-4" />
      </Button>
      <Button variant="outline" size="icon-sm" aria-label={PAYMENT_MESSAGES.DELETE_ACTION} onClick={() => { setDeleting(true); setError(null) }}>
        <Trash2Icon className="size-4 text-destructive" />
      </Button>

      <Sheet open={editing} onOpenChange={(open) => { if (!isPending) { setEditing(open); if (!open) reset() } }}>
        <SheetContent side="right" size="content" showCloseButton={!isPending}>
          <SheetHeader>
            <SheetTitle>{PAYMENT_MESSAGES.CORRECTION_TITLE}</SheetTitle>
            <SheetDescription>{PAYMENT_MESSAGES.REGISTER_MONTHLY_DESCRIPTION}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4 px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`payment-amount-${record.id}`}>{PAYMENT_MESSAGES.AMOUNT_LABEL}</FieldLabel>
                <Input id={`payment-amount-${record.id}`} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </Field>
              {record.kind === PAYMENT_HISTORY_KIND.MONTHLY ? (
                <>
                  <Field>
                    <FieldLabel htmlFor={`payment-period-start-${record.id}`}>{PAYMENT_MESSAGES.FIRST_MONTH_LABEL}</FieldLabel>
                    <Input id={`payment-period-start-${record.id}`} type="month" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`payment-period-end-${record.id}`}>{PAYMENT_MESSAGES.LAST_MONTH_LABEL}</FieldLabel>
                    <Input id={`payment-period-end-${record.id}`} type="month" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`payment-date-${record.id}`}>{PAYMENT_MESSAGES.PAYMENT_DATE_LABEL}</FieldLabel>
                    <Input id={`payment-date-${record.id}`} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`payment-note-${record.id}`}>{PAYMENT_MESSAGES.NOTE_LABEL}</FieldLabel>
                    <Input id={`payment-note-${record.id}`} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor={`class-date-${record.id}`}>{PAYMENT_MESSAGES.CLASS_DATE_LABEL}</FieldLabel>
                  <Input id={`class-date-${record.id}`} type="date" value={classDate} onChange={(event) => setClassDate(event.target.value)} required />
                </Field>
              )}
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
            <SheetFooter className="px-0">
              <SheetClose render={<Button type="button" variant="outline" disabled={isPending} />}>{COMMON_MESSAGES.CANCEL}</SheetClose>
              <Button type="submit" disabled={isPending}>{isPending ? PAYMENT_MESSAGES.SAVING : COMMON_MESSAGES.SAVE}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleting} onOpenChange={(open) => { if (!isPending) setDeleting(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{PAYMENT_MESSAGES.DELETE_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{PAYMENT_MESSAGES.DELETE_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <FieldError>{error}</FieldError>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{COMMON_MESSAGES.CANCEL}</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleDelete}>{isPending ? PAYMENT_MESSAGES.SAVING : PAYMENT_MESSAGES.DELETE_ACTION}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
