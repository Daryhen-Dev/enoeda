"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createDiscipline } from "@/lib/domain/disciplines/actions"
import {
  OWNER_MESSAGES,
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  DISCIPLINE_FORM_MESSAGES,
} from "@/lib/localization/es-ec"

export function DisciplineCreateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setName("")
    setCode("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createDiscipline({ name, code })
      if (result.success) {
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.DISCIPLINE_CREATED)
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
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <SheetTrigger render={<Button variant="default" size="default" />}>
        <PlusIcon data-icon="inline-start" />
        {OWNER_MESSAGES.CREATE_DISCIPLINE}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{DISCIPLINE_FORM_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>
            {DISCIPLINE_FORM_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="new-discipline-name">
                {DISCIPLINE_FORM_MESSAGES.NAME_LABEL}
              </FieldLabel>
              <Input
                id="new-discipline-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-discipline-code">
                {DISCIPLINE_FORM_MESSAGES.CODE_LABEL}
              </FieldLabel>
              <Input
                id="new-discipline-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                pattern="^[a-z0-9-]+$"
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button type="submit" disabled={isPending || !name || !code} className="self-start">
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
