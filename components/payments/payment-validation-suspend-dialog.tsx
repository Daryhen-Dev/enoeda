"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { suspendOverdueEnrollments } from "@/lib/domain/payments/validation-actions"
import type { MonthlyPaymentValidationRow } from "@/lib/domain/payments/validation-actions"
import { COMMON_MESSAGES, PAYMENT_MESSAGES, PAYMENT_VALIDATION_MESSAGES } from "@/lib/localization/es-ec"

const NOTES_MAX_LENGTH = 500

interface PaymentValidationSuspendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRows: MonthlyPaymentValidationRow[]
  branchId: string
  /** Called after a successful suspension so the table can clear its selection. */
  onSuspended: (suspendedCount: number) => void
}

/**
 * Confirmation dialog for the bulk non-payment suspension. Calls the server
 * action with the selected enrollment ids and the optional note; server
 * errors surface inside the dialog so the admin can refresh and retry.
 */
export function PaymentValidationSuspendDialog({
  open,
  onOpenChange,
  selectedRows,
  branchId,
  onSuspended,
}: PaymentValidationSuspendDialogProps) {
  const [isSuspending, setIsSuspending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const router = useRouter()

  const selectedCount = selectedRows.length

  function handleOpenChange(nextOpen: boolean) {
    if (isSuspending) {
      return
    }

    onOpenChange(nextOpen)
    setActionError(null)
  }

  async function handleSuspend() {
    setActionError(null)
    setIsSuspending(true)

    try {
      const trimmedNotes = notes.trim()
      const result = await suspendOverdueEnrollments({
        branch_id: branchId,
        student_discipline_ids: selectedRows.map(
          (row) => row.student_discipline_id
        ),
        notes: trimmedNotes ? trimmedNotes : undefined,
      })

      if (!result.success) {
        setActionError(result.error ?? PAYMENT_VALIDATION_MESSAGES.SUSPEND_FAILURE)
        return
      }

      toast.success(
        PAYMENT_VALIDATION_MESSAGES.SUSPEND_SUCCESS(String(result.data.suspended_count))
      )
      router.refresh()
      onSuspended(result.data.suspended_count)
      onOpenChange(false)
      setNotes("")
    } catch {
      setActionError(PAYMENT_VALIDATION_MESSAGES.SUSPEND_FAILURE)
    } finally {
      setIsSuspending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {PAYMENT_VALIDATION_MESSAGES.SUSPEND_DIALOG_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {PAYMENT_VALIDATION_MESSAGES.SUSPEND_DIALOG_DESCRIPTION(
              String(selectedCount)
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>
              {PAYMENT_VALIDATION_MESSAGES.SUSPEND_FAILURE}
            </AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isSuspending && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {PAYMENT_VALIDATION_MESSAGES.SUSPENDING}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="payment-validation-notes">
            {PAYMENT_VALIDATION_MESSAGES.NOTES_LABEL}
          </FieldLabel>
          <textarea
            id="payment-validation-notes"
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
            value={notes}
            maxLength={NOTES_MAX_LENGTH}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={PAYMENT_MESSAGES.NOTE_PLACEHOLDER}
            disabled={isSuspending}
          />
          <FieldDescription>
            {`${notes.length}/${NOTES_MAX_LENGTH}`}
          </FieldDescription>
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSuspending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isSuspending || selectedCount === 0}
            onClick={handleSuspend}
          >
            {isSuspending
              ? PAYMENT_VALIDATION_MESSAGES.SUSPENDING
              : PAYMENT_VALIDATION_MESSAGES.CONFIRM_SUSPEND}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
