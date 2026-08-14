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
import { assignBranchTeacher } from "@/lib/domain/roles/actions"
import { TEACHER_MANAGEMENT_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec"

interface AssignTeacherDialogProps {
  branchId: string
}

/**
 * Admin-scoped dialog for assigning a teacher to the admin's own branch.
 */
export function GrantRoleDialog({ branchId }: AssignTeacherDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setTargetUserId("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await assignBranchTeacher({
        targetUserId,
        branchId,
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
        {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_ACTION}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_DIALOG_TITLE}
            </DialogTitle>
            <DialogDescription>
              {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_DIALOG_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="mt-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="teacher-user-id">
                {TEACHER_MANAGEMENT_MESSAGES.TARGET_USER_LABEL}
              </FieldLabel>
              <Input
                id="teacher-user-id"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                aria-describedby={error ? "assign-teacher-error" : undefined}
                aria-invalid={Boolean(error)}
                required
              />
            </Field>
            {error && (
              <FieldError id="assign-teacher-error">{error}</FieldError>
            )}
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending || !targetUserId}>
              {isPending
                ? TEACHER_MANAGEMENT_MESSAGES.ASSIGNING
                : TEACHER_MANAGEMENT_MESSAGES.ASSIGN_ACTION}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
