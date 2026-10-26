"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { BanknoteIcon } from "lucide-react"
import { toast } from "sonner"

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
  SheetTrigger,
} from "@/components/ui/sheet"
import { registerClassPayment } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  PAYMENT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface RegisterClassPaymentDialogProps {
  studentDisciplineId: string
  branchId: string
  /** Accessible name for the trigger, e.g. one that names the discipline. */
  triggerAriaLabel?: string
  /** Controlled open state; the built-in trigger keeps working when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Do not render the trigger button (the caller opens the sheet itself). */
  hideTrigger?: boolean
}

function getLocalDateInputValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${date.getFullYear()}-${month}-${day}`
}

export function RegisterClassPaymentDialog({
  studentDisciplineId,
  branchId,
  triggerAriaLabel,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: RegisterClassPaymentDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen
  const [classDate, setClassDate] = useState(getLocalDateInputValue)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setClassDate(getLocalDateInputValue())
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await registerClassPayment({
        student_discipline_id: studentDisciplineId,
        class_date: classDate || undefined,
        branch_id: branchId,
      })
      if (result.success) {
        requestOpenChange(false)
        resetForm()
        toast.success(TOAST_MESSAGES.CLASS_PAYMENT_REGISTERED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <SheetTrigger
          render={
            <Button variant="outline" size="sm" aria-label={triggerAriaLabel} />
          }
        >
          <BanknoteIcon className="size-4" />
          {PAYMENT_MESSAGES.CHARGE_CLASS}
        </SheetTrigger>
      )}
      <SheetContent side="right" size="content" showCloseButton={!isPending}>
        <SheetHeader>
          <SheetTitle>{PAYMENT_MESSAGES.REGISTER_CLASS_TITLE}</SheetTitle>
          <SheetDescription>
            {PAYMENT_MESSAGES.REGISTER_CLASS_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="class-date">
                {PAYMENT_MESSAGES.CLASS_DATE_LABEL}
              </FieldLabel>
              <Input
                id="class-date"
                type="date"
                value={classDate}
                onChange={(event) => setClassDate(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "class-payment-error" : undefined}
              />
            </Field>
            {error && <FieldError id="class-payment-error">{error}</FieldError>}
          </FieldGroup>

          <SheetFooter>
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              {COMMON_MESSAGES.CANCEL}
            </SheetClose>
            <Button type="submit" disabled={isPending}>
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
