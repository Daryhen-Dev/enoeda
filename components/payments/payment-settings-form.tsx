"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  saveBranchPaymentSettings,
  type BranchPaymentSettings,
} from "@/lib/domain/branches/actions"
import { COMMON_MESSAGES, PAYMENT_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

interface PaymentSettingsFormProps {
  branchId: string
  settings: BranchPaymentSettings
}

export function PaymentSettingsForm({ branchId, settings }: PaymentSettingsFormProps) {
  const router = useRouter()
  const [dueDay, setDueDay] = useState(String(settings.payment_due_day))
  const [windowDays, setWindowDays] = useState(String(settings.payment_edit_window_days))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveBranchPaymentSettings({
        branch_id: branchId,
        payment_due_day: Number(dueDay),
        payment_edit_window_days: Number(windowDays),
      })
      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }
      setError(null)
      toast.success(TOAST_MESSAGES.PAYMENT_SETTINGS_UPDATED)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5 rounded-lg border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="payment-due-day">{PAYMENT_MESSAGES.DUE_DAY_LABEL}</FieldLabel>
          <Input id="payment-due-day" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="payment-edit-window">{PAYMENT_MESSAGES.EDIT_WINDOW_LABEL}</FieldLabel>
          <Input id="payment-edit-window" type="number" min="0" max="365" value={windowDays} onChange={(event) => setWindowDays(event.target.value)} required />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <Button type="submit" disabled={isPending}>{isPending ? PAYMENT_MESSAGES.SAVING : PAYMENT_MESSAGES.SAVE_SETTINGS}</Button>
    </form>
  )
}
