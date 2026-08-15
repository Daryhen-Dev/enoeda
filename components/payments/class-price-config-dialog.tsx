"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { SettingsIcon } from "lucide-react"
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
import { configureDisciplineClassPrice } from "@/lib/domain/payments/actions"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  PAYMENT_MESSAGES,
} from "@/lib/localization/es-ec"

interface ClassPriceConfigDialogProps {
  disciplineId: string
  disciplineName: string
}

export function ClassPriceConfigDialog({
  disciplineId,
  disciplineName,
}: ClassPriceConfigDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const numericPrice = price.trim() === "" ? null : Number(price)
      if (numericPrice !== null && (isNaN(numericPrice) || numericPrice < 0)) {
        setError(COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      const result = await configureDisciplineClassPrice({
        discipline_id: disciplineId,
        class_price: numericPrice,
      })
      if (result.success) {
        setOpen(false)
        setPrice("")
        setError(null)
        toast.success(TOAST_MESSAGES.CLASS_PRICE_UPDATED)
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
          setPrice("")
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="justify-start gap-2" />
        }
      >
        <SettingsIcon className="size-4" />
        {disciplineName}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PAYMENT_MESSAGES.CONFIGURE_PRICE_TITLE}</DialogTitle>
          <DialogDescription>
            {PAYMENT_MESSAGES.CONFIGURE_PRICE_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="class-price">
                {PAYMENT_MESSAGES.PRICE_LABEL}
              </FieldLabel>
              <Input
                id="class-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={PAYMENT_MESSAGES.PRICE_PLACEHOLDER}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? PAYMENT_MESSAGES.SAVING : COMMON_MESSAGES.SAVE}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
