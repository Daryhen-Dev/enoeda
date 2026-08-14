"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

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
import { createBranch } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec"

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
      <DialogTrigger render={<Button variant="default" size="default" />}>
        <PlusIcon data-icon="inline-start" />
        {OWNER_MESSAGES.CREATE_BRANCH}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{OWNER_MESSAGES.CREATE_BRANCH_TITLE}</DialogTitle>
            <DialogDescription>
              {OWNER_MESSAGES.CREATE_BRANCH_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="mt-4">
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

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending || !name}>
              {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
