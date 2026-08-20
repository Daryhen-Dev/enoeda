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
}: RegisterClassPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [classDate, setClassDate] = useState(getLocalDateInputValue)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setClassDate(getLocalDateInputValue())
    setError(null)
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
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.CLASS_PAYMENT_REGISTERED)
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
        <BanknoteIcon className="size-4" />
        {PAYMENT_MESSAGES.CHARGE_CLASS}
      </SheetTrigger>
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
