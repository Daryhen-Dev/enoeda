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
import {
  assignTeacherToExistingAccount,
  createBranchTeacher,
} from "@/lib/domain/roles/actions"
import type { CreatedAccountCredentials } from "@/lib/domain/roles/actions"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  TEACHER_MANAGEMENT_MESSAGES,
  ROLE_CREATION_MESSAGES,
  COMMON_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface AssignTeacherDialogProps {
  branchId: string
}

type AssignMode = "existing" | "create"

const ASSIGN_MODES: AssignMode[] = ["existing", "create"]

/**
 * Admin-scoped dialog for granting the teacher role within the admin's own
 * branch. Two modes: assign the role to an already-existing account (never
 * creates anything) or create a brand-new teacher account. Authorization
 * (admin-of-this-branch) is enforced server-side by both server actions.
 */
export function GrantRoleDialog({ branchId }: AssignTeacherDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AssignMode>("existing")
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [surname, setSurname] = useState("")
  const [phone, setPhone] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedAccountCredentials | null>(null)

  function resetForm() {
    setEmail("")
    setFirstName("")
    setSurname("")
    setPhone("")
    setDateOfBirth("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      if (mode === "existing") {
        const result = await assignTeacherToExistingAccount({
          email,
          branchId,
          first_name: firstName,
          surname,
          phone: phone || undefined,
          date_of_birth: dateOfBirth,
        })
        if (result.success) {
          setOpen(false)
          resetForm()
          toast.success(
            TEACHER_MANAGEMENT_MESSAGES.EXISTING_ACCOUNT_ASSIGNED_SUCCESS
          )
          router.refresh()
        } else {
          setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        }
        return
      }

      const result = await createBranchTeacher({
        email,
        branchId,
        first_name: firstName,
        surname,
        phone: phone || undefined,
        date_of_birth: dateOfBirth,
      })
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
              {mode === "existing"
                ? TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_DESCRIPTION
                : TEACHER_MANAGEMENT_MESSAGES.ASSIGN_DIALOG_DESCRIPTION}
            </SheetDescription>
          </SheetHeader>

          <ToggleGroup
            multiple={false}
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0] as AssignMode | undefined
              if (next && ASSIGN_MODES.includes(next)) setMode(next)
            }}
            variant="outline"
            aria-label={TEACHER_MANAGEMENT_MESSAGES.MODE_TOGGLE_LABEL}
          >
            <ToggleGroupItem value="existing">
              {TEACHER_MANAGEMENT_MESSAGES.MODE_EXISTING}
            </ToggleGroupItem>
            <ToggleGroupItem value="create">
              {TEACHER_MANAGEMENT_MESSAGES.MODE_CREATE}
            </ToggleGroupItem>
          </ToggleGroup>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="teacher-first-name">
                  {ROLE_CREATION_MESSAGES.FIRST_NAME_LABEL}
                </FieldLabel>
                <Input
                  id="teacher-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="teacher-surname">
                  {ROLE_CREATION_MESSAGES.SURNAME_LABEL}
                </FieldLabel>
                <Input
                  id="teacher-surname"
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="teacher-phone">
                  {ROLE_CREATION_MESSAGES.PHONE_LABEL}
                </FieldLabel>
                <Input
                  id="teacher-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="teacher-date-of-birth">
                  {ROLE_CREATION_MESSAGES.DATE_OF_BIRTH_LABEL}
                </FieldLabel>
                <Input
                  id="teacher-date-of-birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </Field>
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

            <Button
              type="submit"
              disabled={
                isPending || !email || !firstName || !surname || !dateOfBirth
              }
              className="self-start"
            >
              {isPending
                ? mode === "existing"
                  ? TEACHER_MANAGEMENT_MESSAGES.ASSIGNING
                  : ROLE_CREATION_MESSAGES.CREATING_ACCOUNT
                : mode === "existing"
                  ? TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_SUBMIT
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
