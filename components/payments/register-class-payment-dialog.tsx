"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { BanknoteIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { registerClassPayment } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  PAYMENT_MESSAGES,
} from "@/lib/localization/es-ec"

interface RegisterClassPaymentDialogProps {
  studentDisciplineId: string
  branchId: string
}

export function RegisterClassPaymentDialog({
  studentDisciplineId,
  branchId,
}: RegisterClassPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [classDate, setClassDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        setClassDate("")
        setError(null)
        toast.success(TOAST_MESSAGES.CLASS_PAYMENT_REGISTERED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setClassDate("")
          setError(null)
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <BanknoteIcon className="size-4" />
        {PAYMENT_MESSAGES.CHARGE_CLASS}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PAYMENT_MESSAGES.REGISTER_CLASS_TITLE}</DialogTitle>
          <DialogDescription>
            {PAYMENT_MESSAGES.REGISTER_CLASS_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

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
                onChange={(e) => setClassDate(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? PAYMENT_MESSAGES.SAVING : PAYMENT_MESSAGES.REGISTER_ACTION}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
