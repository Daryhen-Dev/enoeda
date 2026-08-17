"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { registerMonthlyPayment } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  PAYMENT_MESSAGES,
} from "@/lib/localization/es-ec"

interface RegisterMonthlyPaymentDialogProps {
  studentDisciplineId: string
  branchId: string
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

export function RegisterMonthlyPaymentDialog({
  studentDisciplineId,
  branchId,
}: RegisterMonthlyPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [monthsCovered, setMonthsCovered] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setAmount("")
    setMonthsCovered("")
    setPaymentDate("")
    setNote("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!monthsCovered) return
    startTransition(async () => {
      const result = await registerMonthlyPayment({
        student_discipline_id: studentDisciplineId,
        amount: Number(amount),
        months_covered: Number(monthsCovered),
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        {PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PAYMENT_MESSAGES.REGISTER_MONTHLY_TITLE}</DialogTitle>
          <DialogDescription>
            {PAYMENT_MESSAGES.REGISTER_MONTHLY_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

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
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel>{PAYMENT_MESSAGES.MONTHS_LABEL}</FieldLabel>
              <Select
                value={monthsCovered}
                onValueChange={(v) => setMonthsCovered(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={PAYMENT_MESSAGES.MONTHS_PLACEHOLDER} />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="pay-date">
                {PAYMENT_MESSAGES.PAYMENT_DATE_LABEL}
              </FieldLabel>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
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
                onChange={(e) => setNote(e.target.value)}
                placeholder={PAYMENT_MESSAGES.NOTE_PLACEHOLDER}
                maxLength={500}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !amount || !monthsCovered}
            >
              {isPending ? PAYMENT_MESSAGES.SAVING : PAYMENT_MESSAGES.REGISTER_ACTION}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
