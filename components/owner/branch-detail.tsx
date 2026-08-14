"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import {
  updateBranch,
  deactivateBranch,
  reactivateBranch,
} from "@/lib/domain/branches/actions"
import type { BranchRecord } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES, COMMON_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

const BRANCH_STATUS_OPTIONS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const

type BranchStatusOption =
  (typeof BRANCH_STATUS_OPTIONS)[keyof typeof BRANCH_STATUS_OPTIONS]

function statusFromIsActive(isActive: boolean): BranchStatusOption {
  return isActive ? BRANCH_STATUS_OPTIONS.ACTIVE : BRANCH_STATUS_OPTIONS.INACTIVE
}

interface BranchDetailProps {
  branch: BranchRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Owner branch edit sheet — content-sized (≥40% viewport width) per the
 * app's standard for edit/detail sheets. The status combobox only stages
 * a local selection; nothing is submitted to the server until the user
 * presses "Guardar". Switching to "Inactiva" additionally asks for
 * confirmation before the save actually runs.
 */
export function BranchDetail({ branch, open, onOpenChange }: BranchDetailProps) {
  const router = useRouter()
  const [name, setName] = useState(branch.name)
  const [address, setAddress] = useState(branch.address ?? "")
  const [phone, setPhone] = useState(branch.phone ?? "")
  const [status, setStatus] = useState<BranchStatusOption>(
    statusFromIsActive(branch.is_active)
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentStatus = statusFromIsActive(branch.is_active)

  function persistChanges() {
    startTransition(async () => {
      const updateResult = await updateBranch({
        id: branch.id,
        name,
        address: address || null,
        phone: phone || null,
      })
      if (!updateResult.success) {
        setError(updateResult.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      let statusChanged = false
      if (status !== currentStatus) {
        const statusResult =
          status === BRANCH_STATUS_OPTIONS.ACTIVE
            ? await reactivateBranch(branch.id)
            : await deactivateBranch(branch.id)

        if (!statusResult.success) {
          setError(statusResult.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
          return
        }
        statusChanged = true
      }

      setError(null)
      toast.success(
        statusChanged
          ? status === BRANCH_STATUS_OPTIONS.ACTIVE
            ? TOAST_MESSAGES.BRANCH_REACTIVATED
            : TOAST_MESSAGES.BRANCH_DEACTIVATED
          : TOAST_MESSAGES.BRANCH_UPDATED
      )
      router.refresh()
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Deactivating requires explicit confirmation before the save runs.
    if (status === BRANCH_STATUS_OPTIONS.INACTIVE && currentStatus !== status) {
      setConfirmingDeactivation(true)
      return
    }

    persistChanges()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{OWNER_MESSAGES.EDIT_BRANCH}</SheetTitle>
          <SheetDescription>
            {OWNER_MESSAGES.BRANCH_DETAIL_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="branch-name">
                {OWNER_MESSAGES.BRANCH_NAME}
              </FieldLabel>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="branch-address">
                {OWNER_MESSAGES.BRANCH_ADDRESS}
              </FieldLabel>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="branch-phone">
                {OWNER_MESSAGES.BRANCH_PHONE}
              </FieldLabel>
              <Input
                id="branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="branch-status">
                {OWNER_MESSAGES.BRANCH_STATUS}
              </FieldLabel>
              <Select
                value={status}
                onValueChange={(value: BranchStatusOption | null) => {
                  if (value !== null) setStatus(value)
                }}
                disabled={isPending}
              >
                <SelectTrigger id="branch-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BRANCH_STATUS_OPTIONS.ACTIVE}>
                    {OWNER_MESSAGES.STATUS_ACTIVE}
                  </SelectItem>
                  <SelectItem value={BRANCH_STATUS_OPTIONS.INACTIVE}>
                    {OWNER_MESSAGES.STATUS_INACTIVE}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.SAVE}
          </Button>
        </form>

        <AlertDialog
          open={confirmingDeactivation}
          onOpenChange={setConfirmingDeactivation}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {OWNER_MESSAGES.DEACTIVATE_CONFIRMATION_TITLE}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {OWNER_MESSAGES.DEACTIVATE_CONFIRMATION_DESCRIPTION}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>
                {COMMON_MESSAGES.CANCEL}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  setConfirmingDeactivation(false)
                  persistChanges()
                }}
              >
                {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.SAVE}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
