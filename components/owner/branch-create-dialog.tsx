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
import { createBranch } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES, COMMON_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

export function BranchCreateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setName("")
    setAddress("")
    setPhone("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createBranch({
        name,
        address: address || undefined,
        phone: phone || undefined,
        time_zone: "America/Guayaquil",
        is_active: true,
      })
      if (result.success) {
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.BRANCH_CREATED)
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
        {OWNER_MESSAGES.CREATE_BRANCH}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{OWNER_MESSAGES.CREATE_BRANCH_TITLE}</SheetTitle>
          <SheetDescription>
            {OWNER_MESSAGES.CREATE_BRANCH_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="new-branch-name">
                {OWNER_MESSAGES.BRANCH_NAME}
              </FieldLabel>
              <Input
                id="new-branch-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-branch-address">
                {OWNER_MESSAGES.BRANCH_ADDRESS}
              </FieldLabel>
              <Input
                id="new-branch-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-branch-phone">
                {OWNER_MESSAGES.BRANCH_PHONE}
              </FieldLabel>
              <Input
                id="new-branch-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button type="submit" disabled={isPending || !name} className="self-start">
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
