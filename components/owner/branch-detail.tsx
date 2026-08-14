"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  updateBranch,
  deactivateBranch,
  reactivateBranch,
} from "@/lib/domain/branches/actions"
import type { BranchRecord } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec"

interface BranchDetailProps {
  branch: BranchRecord
}

export function BranchDetail({ branch }: BranchDetailProps) {
  const router = useRouter()
  const [name, setName] = useState(branch.name)
  const [address, setAddress] = useState(branch.address ?? "")
  const [phone, setPhone] = useState(branch.phone ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateBranch({
        id: branch.id,
        name,
        address: address || null,
        phone: phone || null,
      })
      if (result.success) {
        setError(null)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <Button type="submit" disabled={isPending}>
          {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.SAVE}
        </Button>
      </form>

      <div className="border-t pt-4">
        {branch.is_active ? (
          <DeactivateAction branchId={branch.id} />
        ) : (
          <ReactivateAction branchId={branch.id} />
        )}
      </div>
    </div>
  )
}

function DeactivateAction({ branchId }: { branchId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateBranch(branchId)
      if (result.success) {
        setError(null)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{OWNER_MESSAGES.DEACTIVATE_ERROR}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>
          {OWNER_MESSAGES.DEACTIVATE_ACTION}
        </AlertDialogTrigger>
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
              onClick={handleDeactivate}
            >
              {isPending
                ? COMMON_MESSAGES.LOADING
                : OWNER_MESSAGES.DEACTIVATE_ACTION}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ReactivateAction({ branchId }: { branchId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateBranch(branchId)
      if (result.success) {
        setError(null)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{OWNER_MESSAGES.REACTIVATE_ERROR}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button variant="default" disabled={isPending} onClick={handleReactivate}>
        {isPending ? COMMON_MESSAGES.LOADING : OWNER_MESSAGES.REACTIVATE_ACTION}
      </Button>
    </>
  )
}
