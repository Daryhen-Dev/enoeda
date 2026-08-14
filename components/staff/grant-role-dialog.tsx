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
import { CreatedAccountDialog } from "@/components/owner/created-account-dialog"
import { createBranchTeacher } from "@/lib/domain/roles/actions"
import type { CreatedAccountCredentials } from "@/lib/domain/roles/actions"
import {
  TEACHER_MANAGEMENT_MESSAGES,
  ROLE_CREATION_MESSAGES,
  COMMON_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface AssignTeacherDialogProps {
  branchId: string
}

/**
 * Admin-scoped dialog for creating a brand-new teacher account within
 * the admin's own branch. Authorization (admin-of-this-branch) is
 * enforced server-side by `createBranchTeacher`.
 */
export function GrantRoleDialog({ branchId }: AssignTeacherDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedAccountCredentials | null>(null)

  function resetForm() {
    setEmail("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createBranchTeacher({ email, branchId })
      if (result.success && result.data) {
        setOpen(false)
        resetForm()
        setCreatedCredentials(result.data)
        toast.success(TOAST_MESSAGES.TEACHER_ACCOUNT_CREATED)
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) resetForm()
        }}
      >
        <SheetTrigger render={<Button variant="default" size="default" />}>
          <PlusIcon data-icon="inline-start" />
          {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_ACTION}
        </SheetTrigger>
        <SheetContent side="right" size="content">
          <SheetHeader>
            <SheetTitle>
              {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_DIALOG_TITLE}
            </SheetTitle>
            <SheetDescription>
              {TEACHER_MANAGEMENT_MESSAGES.ASSIGN_DIALOG_DESCRIPTION}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="teacher-email">
                  {ROLE_CREATION_MESSAGES.EMAIL_LABEL}
                </FieldLabel>
                <Input
                  id="teacher-email"
                  type="email"
                  placeholder={ROLE_CREATION_MESSAGES.EMAIL_PLACEHOLDER}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? "assign-teacher-error" : undefined}
                  aria-invalid={Boolean(error)}
                  required
                />
              </Field>
              {error && (
                <FieldError id="assign-teacher-error">{error}</FieldError>
              )}
            </FieldGroup>

            <Button type="submit" disabled={isPending || !email} className="self-start">
              {isPending
                ? ROLE_CREATION_MESSAGES.CREATING_ACCOUNT
                : ROLE_CREATION_MESSAGES.CREATE_ACCOUNT_ACTION}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <CreatedAccountDialog
        credentials={createdCredentials}
        onClose={() => {
          setCreatedCredentials(null)
          router.refresh()
        }}
      />
    </>
  )
}
