"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { markFinePaid, voidConductRecord } from "@/lib/domain/conduct"
import type { ConductRecord } from "@/lib/domain/conduct"
import { CONDUCT_KINDS, CONDUCT_STATUSES } from "@/lib/domain/conduct"
import {
  COMMON_MESSAGES,
  CONDUCT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface ConductRecordActionsProps {
  record: ConductRecord
  branchId: string
}

/**
 * Row actions for a conduct record in the student detail "Conducta" tab.
 * The panel only renders this component for non-voided records of viewers
 * who can manage; the component further gates by record state: pending
 * fines can be marked as paid (confirm dialog) and non-voided records that
 * are not paid fines can be voided (dialog with a required reason).
 */
export function ConductRecordActions({
  record,
  branchId,
}: ConductRecordActionsProps) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")
  const [voidError, setVoidError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const voidReasonId = useId()

  const isFine = record.kind === CONDUCT_KINDS.FINE
  const canMarkPaid = isFine && record.status === CONDUCT_STATUSES.PENDING
  const canVoid = !(isFine && record.status === CONDUCT_STATUSES.PAID)

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markFinePaid({ id: record.id, branch_id: branchId })
      if (result.success) {
        setPayDialogOpen(false)
        toast.success(TOAST_MESSAGES.FINE_MARKED_PAID)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function closeVoidDialog() {
    if (isPending) return
    setVoidDialogOpen(false)
    setVoidReason("")
    setVoidError(null)
  }

  function handleVoid() {
    const reason = voidReason.trim()
    if (reason.length === 0) {
      setVoidError(CONDUCT_MESSAGES.VOID_REASON_REQUIRED)
      return
    }
    if (reason.length > 500) {
      setVoidError(CONDUCT_MESSAGES.VOID_REASON_MAX)
      return
    }

    startTransition(async () => {
      const result = await voidConductRecord({
        id: record.id,
        branch_id: branchId,
        void_reason: reason,
      })
      if (result.success) {
        setVoidDialogOpen(false)
        setVoidReason("")
        setVoidError(null)
        toast.success(TOAST_MESSAGES.CONDUCT_VOIDED)
        router.refresh()
      } else {
        setVoidError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <div className="flex gap-2">
      {canMarkPaid && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPayDialogOpen(true)}
          disabled={isPending}
        >
          {CONDUCT_MESSAGES.MARK_PAID_ACTION}
        </Button>
      )}
      {canVoid && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVoidDialogOpen(true)}
          disabled={isPending}
        >
          {CONDUCT_MESSAGES.VOID_ACTION}
        </Button>
      )}

      <AlertDialog
        open={payDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isPending) {
            setPayDialogOpen(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {CONDUCT_MESSAGES.MARK_PAID_TITLE}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {CONDUCT_MESSAGES.MARK_PAID_DESCRIPTION}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {COMMON_MESSAGES.CANCEL}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isPending}
              onClick={handleMarkPaid}
            >
              {isPending
                ? CONDUCT_MESSAGES.MARKING_PAID
                : CONDUCT_MESSAGES.MARK_PAID_CONFIRM}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={voidDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeVoidDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{CONDUCT_MESSAGES.VOID_TITLE}</DialogTitle>
            <DialogDescription>
              {CONDUCT_MESSAGES.VOID_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleVoid()
            }}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <Field data-invalid={voidError !== null}>
                <FieldLabel htmlFor={voidReasonId}>
                  {CONDUCT_MESSAGES.VOID_REASON_LABEL}
                </FieldLabel>
                <textarea
                  id={voidReasonId}
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
                  value={voidReason}
                  onChange={(event) => {
                    setVoidReason(event.target.value)
                    if (voidError !== null) {
                      setVoidError(null)
                    }
                  }}
                  placeholder={CONDUCT_MESSAGES.VOID_REASON_PLACEHOLDER}
                  maxLength={500}
                  aria-invalid={voidError !== null}
                  disabled={isPending}
                />
                {voidError && <FieldError>{voidError}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeVoidDialog}
                disabled={isPending}
              >
                {COMMON_MESSAGES.CANCEL}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? CONDUCT_MESSAGES.VOIDING
                  : CONDUCT_MESSAGES.VOID_CONFIRM}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
