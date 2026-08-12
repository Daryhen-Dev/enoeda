"use client"

import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createStudent,
  getStudentById,
  updateStudent,
} from "@/lib/domain/students/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ActiveBranchOption {
  id: string
  name: string
}

interface StudentFormValues {
  branch_id: string
  first_name: string
  surname: string
  national_id: string
  email: string
  date_of_birth: string
}

interface StudentFormDialogProps {
  branches: ActiveBranchOption[]
  studentId?: string
}

function getDefaultValues(): StudentFormValues {
  return {
    branch_id: "",
    first_name: "",
    surname: "",
    national_id: "",
    email: "",
    date_of_birth: "",
  }
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function hasActiveBranch(branches: ActiveBranchOption[], branchId: string): boolean {
  return branches.some((branch) => branch.id === branchId)
}

export function StudentFormDialog({
  branches,
  studentId,
}: StudentFormDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const branchId = useId()
  const firstNameId = useId()
  const surnameId = useId()
  const nationalId = useId()
  const emailId = useId()
  const dateOfBirthId = useId()
  const form = useForm<StudentFormValues>({
    defaultValues: getDefaultValues(),
    mode: "onBlur",
  })
  const isEditing = studentId !== undefined
  const isPending = form.formState.isSubmitting || isLoadingStudent
  const title = isEditing ? "Edit student" : "Create student"
  const submitLabel = isEditing ? "Save changes" : "Create student"

  async function loadStudent() {
    if (studentId === undefined) {
      return
    }

    setIsLoadingStudent(true)
    setActionError(null)

    try {
      const result = await getStudentById(studentId)

      if (!result.success || result.data === undefined) {
        setActionError(result.error ?? "Unable to load the student.")
        return
      }

      form.reset({
        branch_id: hasActiveBranch(branches, result.data.branch_id)
          ? result.data.branch_id
          : "",
        first_name: result.data.first_name,
        surname: result.data.surname,
        national_id: result.data.national_id,
        email: result.data.email,
        date_of_birth: formatDateForInput(result.data.date_of_birth),
      })
    } catch {
      setActionError("Unable to load the student.")
    } finally {
      setIsLoadingStudent(false)
    }
  }

  function handleOpenChange(nextIsOpen: boolean) {
    if (isPending) {
      return
    }

    setIsOpen(nextIsOpen)
    setActionError(null)
    form.reset(getDefaultValues())

    if (nextIsOpen && isEditing) {
      void loadStudent()
    }
  }

  async function handleSubmit(values: StudentFormValues) {
    if (isLoadingStudent) {
      return
    }

    setActionError(null)

    try {
      const result = isEditing
        ? await updateStudent({ id: studentId, ...values })
        : await createStudent({ ...values, is_active: true })

      if (!result.success) {
        setActionError(result.error ?? "Unable to save the student.")
        return
      }

      form.reset(getDefaultValues())
      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError("Unable to save the student.")
    }
  }

  const { errors } = form.formState

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant={isEditing ? "outline" : "default"} size="sm" />}
      >
        {isEditing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {isEditing ? "Edit" : "Create"}
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this student's personal and branch details."
              : "Add a student to an active branch."}
          </DialogDescription>
        </DialogHeader>

        {isLoadingStudent ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            Loading student details…
          </p>
        ) : (
          <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
            {actionError && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Unable to save student</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Controller
                control={form.control}
                name="branch_id"
                rules={{
                  validate: (value) =>
                    hasActiveBranch(branches, value) || "Select an active branch",
                }}
                render={({ field, fieldState }) => (
                  <Field data-invalid={Boolean(fieldState.error)}>
                    <FieldLabel htmlFor={branchId}>Branch</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) {
                          field.onChange(value)
                        }
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id={branchId}
                        className="w-full"
                        aria-describedby={fieldState.error ? `${branchId}-error` : undefined}
                        aria-invalid={Boolean(fieldState.error)}
                      >
                        <SelectValue placeholder="Select an active branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError id={`${branchId}-error`} errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Field data-invalid={Boolean(errors.first_name)}>
                <FieldLabel htmlFor={firstNameId}>First name</FieldLabel>
                <Input
                  id={firstNameId}
                  aria-describedby={errors.first_name ? `${firstNameId}-error` : undefined}
                  aria-invalid={Boolean(errors.first_name)}
                  disabled={isPending}
                  {...form.register("first_name", {
                    required: "First name is required",
                    maxLength: { value: 100, message: "First name must be 100 characters or less" },
                  })}
                />
                <FieldError id={`${firstNameId}-error`} errors={[errors.first_name]} />
              </Field>

              <Field data-invalid={Boolean(errors.surname)}>
                <FieldLabel htmlFor={surnameId}>Surname</FieldLabel>
                <Input
                  id={surnameId}
                  aria-describedby={errors.surname ? `${surnameId}-error` : undefined}
                  aria-invalid={Boolean(errors.surname)}
                  disabled={isPending}
                  {...form.register("surname", {
                    required: "Surname is required",
                    maxLength: { value: 100, message: "Surname must be 100 characters or less" },
                  })}
                />
                <FieldError id={`${surnameId}-error`} errors={[errors.surname]} />
              </Field>

              <Field data-invalid={Boolean(errors.national_id)}>
                <FieldLabel htmlFor={nationalId}>National ID</FieldLabel>
                <Input
                  id={nationalId}
                  aria-describedby={errors.national_id ? `${nationalId}-error` : undefined}
                  aria-invalid={Boolean(errors.national_id)}
                  disabled={isPending}
                  {...form.register("national_id", {
                    required: "National ID is required",
                    maxLength: { value: 30, message: "National ID must be 30 characters or less" },
                  })}
                />
                <FieldError id={`${nationalId}-error`} errors={[errors.national_id]} />
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                <Input
                  id={emailId}
                  type="email"
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                  aria-invalid={Boolean(errors.email)}
                  disabled={isPending}
                  {...form.register("email", {
                    required: "Email is required",
                    pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address" },
                  })}
                />
                <FieldError id={`${emailId}-error`} errors={[errors.email]} />
              </Field>

              <Field data-invalid={Boolean(errors.date_of_birth)}>
                <FieldLabel htmlFor={dateOfBirthId}>Date of birth</FieldLabel>
                <Input
                  id={dateOfBirthId}
                  type="date"
                  aria-describedby={errors.date_of_birth ? `${dateOfBirthId}-error` : undefined}
                  aria-invalid={Boolean(errors.date_of_birth)}
                  disabled={isPending}
                  {...form.register("date_of_birth", {
                    required: "Date of birth is required",
                    pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Enter a valid date" },
                  })}
                />
                <FieldError id={`${dateOfBirthId}-error`} errors={[errors.date_of_birth]} />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {form.formState.isSubmitting ? "Saving..." : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
