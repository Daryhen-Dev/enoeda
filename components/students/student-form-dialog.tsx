"use client"

import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createStudent,
  getStudentById,
  updateStudent,
} from "@/lib/domain/students/actions"
import { enrollStudent } from "@/lib/domain/disciplines/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  COMMON_MESSAGES,
  ENROLLMENT_MESSAGES,
  PRODUCT_TERMS,
  STUDENT_FORM_MESSAGES,
  STUDENT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

export interface ActiveBranchOption {
  id: string
  name: string
}

export interface DisciplineOption {
  id: string
  name: string
}

interface StudentFormValues {
  branch_id: string
  first_name: string
  surname: string
  national_id: string
  email: string
  phone: string
  date_of_birth: string
  discipline_ids: string[]
  enrolled_at: string
}

interface StudentFormDialogProps {
  branches: ActiveBranchOption[]
  disciplines?: DisciplineOption[]
  studentId?: string
  lockedBranchId?: string
  branchId?: string
  onCreated?: () => void
}

function getTodayString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getDefaultValues(): StudentFormValues {
  return {
    branch_id: "",
    first_name: "",
    surname: "",
    national_id: "",
    email: "",
    phone: "",
    date_of_birth: "",
    discipline_ids: [],
    enrolled_at: getTodayString(),
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
  disciplines = [],
  studentId,
  lockedBranchId,
  branchId: contextBranchId,
  onCreated,
}: StudentFormDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const branchFieldId = useId()
  const firstNameId = useId()
  const surnameId = useId()
  const nationalId = useId()
  const emailId = useId()
  const phoneId = useId()
  const dateOfBirthId = useId()
  const enrolledAtId = useId()
  const form = useForm<StudentFormValues>({
    defaultValues: {
      ...getDefaultValues(),
      branch_id: lockedBranchId ?? "",
    },
    mode: "onBlur",
  })
  const isEditing = studentId !== undefined
  const isPending = form.formState.isSubmitting || isLoadingStudent
  const title = isEditing
    ? STUDENT_FORM_MESSAGES.EDIT_TITLE
    : STUDENT_FORM_MESSAGES.CREATE_TITLE
  const submitLabel = isEditing
    ? STUDENT_FORM_MESSAGES.SAVE_CHANGES
    : COMMON_MESSAGES.CREATE

  async function loadStudent() {
    if (studentId === undefined) {
      return
    }

    setIsLoadingStudent(true)
    setActionError(null)

    try {
      const result = await getStudentById(studentId, contextBranchId ?? "")

      if (!result.success || result.data === undefined) {
        setActionError(result.error ?? STUDENT_FORM_MESSAGES.LOAD_FAILURE)
        return
      }

      form.reset({
        branch_id: contextBranchId ?? lockedBranchId ?? result.data.branch_id,
        first_name: result.data.first_name,
        surname: result.data.surname,
        national_id: result.data.national_id,
        email: result.data.email,
        phone: result.data.phone ?? "",
        date_of_birth: formatDateForInput(result.data.date_of_birth),
        discipline_ids: [],
        enrolled_at: getTodayString(),
      })
    } catch {
      setActionError(STUDENT_FORM_MESSAGES.LOAD_FAILURE)
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
    form.reset({
      ...getDefaultValues(),
      branch_id: lockedBranchId ?? "",
    })

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
      if (isEditing) {
        const result = await updateStudent(
          {
            id: studentId,
            ...values,
            branch_id: contextBranchId ?? lockedBranchId ?? values.branch_id,
            phone: values.phone === "" ? null : values.phone,
          },
          contextBranchId
        )
        if (!result.success) {
          setActionError(result.error ?? STUDENT_FORM_MESSAGES.SAVE_FAILURE)
          return
        }
        toast.success(TOAST_MESSAGES.STUDENT_UPDATED)
      } else {
        // Create student, then enroll in selected disciplines
        const createResult = await createStudent({
          ...values,
          phone: values.phone === "" ? null : values.phone,
          is_active: true,
        })
        if (!createResult.success || !createResult.data) {
          setActionError(createResult.error ?? STUDENT_FORM_MESSAGES.SAVE_FAILURE)
          return
        }

        if (values.discipline_ids.length > 0) {
          const enrollResult = await enrollStudent({
            student_id: createResult.data.id,
            discipline_ids: values.discipline_ids,
            branch_id: values.branch_id,
            enrolled_at: values.enrolled_at || undefined,
          })
          if (!enrollResult.success) {
            setActionError(enrollResult.error ?? STUDENT_FORM_MESSAGES.SAVE_FAILURE)
            return
          }
        }
        toast.success(TOAST_MESSAGES.STUDENT_CREATED)
        onCreated?.()
      }

      form.reset(getDefaultValues())
      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError(STUDENT_FORM_MESSAGES.SAVE_FAILURE)
    }
  }

  const { errors } = form.formState

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={<Button variant={isEditing ? "outline" : "default"} size="sm" />}
      >
        {isEditing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {isEditing ? COMMON_MESSAGES.EDIT : COMMON_MESSAGES.CREATE}
      </SheetTrigger>
      <SheetContent side="right" size="content" showCloseButton={!isPending}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? STUDENT_FORM_MESSAGES.EDIT_DESCRIPTION
              : STUDENT_FORM_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        {isLoadingStudent ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {STUDENT_FORM_MESSAGES.LOADING_DETAILS}
          </p>
        ) : (
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            {actionError && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{STUDENT_FORM_MESSAGES.DESTRUCTIVE_ALERT_TITLE}</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Controller
                control={form.control}
                name="branch_id"
                rules={{
                  validate: (value) =>
                    isEditing ||
                    hasActiveBranch(branches, value) ||
                    STUDENT_FORM_MESSAGES.ACTIVE_BRANCH_REQUIRED,
                }}
                render={({ field, fieldState }) => (
                  <Field data-invalid={Boolean(fieldState.error)}>
                    <FieldLabel htmlFor={branchFieldId}>{PRODUCT_TERMS.BRANCH}</FieldLabel>
                    {isEditing ? (
                      <Input
                        id={branchFieldId}
                        value={
                          branches.find(
                            (branch) =>
                              branch.id ===
                              (contextBranchId ?? lockedBranchId ?? field.value)
                          )?.name ?? STUDENT_FORM_MESSAGES.EDIT_BRANCH_UNAVAILABLE
                        }
                        disabled
                        readOnly
                      />
                    ) : lockedBranchId ? (
                      <Input
                        id={branchFieldId}
                        value={branches.find((b) => b.id === lockedBranchId)?.name ?? lockedBranchId}
                        disabled
                        readOnly
                      />
                    ) : (
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
                          id={branchFieldId}
                          className="w-full"
                          aria-describedby={fieldState.error ? `${branchFieldId}-error` : undefined}
                          aria-invalid={Boolean(fieldState.error)}
                        >
                          <SelectValue placeholder={STUDENT_FORM_MESSAGES.ACTIVE_BRANCH_PLACEHOLDER} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FieldError id={`${branchFieldId}-error`} errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Field data-invalid={Boolean(errors.first_name)}>
                <FieldLabel htmlFor={firstNameId}>{STUDENT_FORM_MESSAGES.FIRST_NAME_LABEL}</FieldLabel>
                <Input
                  id={firstNameId}
                  aria-describedby={errors.first_name ? `${firstNameId}-error` : undefined}
                  aria-invalid={Boolean(errors.first_name)}
                  disabled={isPending}
                  {...form.register("first_name", {
                    required: STUDENT_MESSAGES.FIRST_NAME_REQUIRED,
                    maxLength: { value: 100, message: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH },
                  })}
                />
                <FieldError id={`${firstNameId}-error`} errors={[errors.first_name]} />
              </Field>

              <Field data-invalid={Boolean(errors.surname)}>
                <FieldLabel htmlFor={surnameId}>{STUDENT_FORM_MESSAGES.SURNAME_LABEL}</FieldLabel>
                <Input
                  id={surnameId}
                  aria-describedby={errors.surname ? `${surnameId}-error` : undefined}
                  aria-invalid={Boolean(errors.surname)}
                  disabled={isPending}
                  {...form.register("surname", {
                    required: STUDENT_MESSAGES.SURNAME_REQUIRED,
                    maxLength: { value: 100, message: STUDENT_MESSAGES.SURNAME_MAX_LENGTH },
                  })}
                />
                <FieldError id={`${surnameId}-error`} errors={[errors.surname]} />
              </Field>

              <Field data-invalid={Boolean(errors.national_id)}>
                <FieldLabel htmlFor={nationalId}>{PRODUCT_TERMS.NATIONAL_ID}</FieldLabel>
                <Input
                  id={nationalId}
                  aria-describedby={errors.national_id ? `${nationalId}-error` : undefined}
                  aria-invalid={Boolean(errors.national_id)}
                  disabled={isPending}
                  {...form.register("national_id", {
                    required: STUDENT_MESSAGES.NATIONAL_ID_REQUIRED,
                    maxLength: { value: 30, message: STUDENT_MESSAGES.NATIONAL_ID_MAX_LENGTH },
                  })}
                />
                <FieldError id={`${nationalId}-error`} errors={[errors.national_id]} />
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor={emailId}>{STUDENT_FORM_MESSAGES.EMAIL_LABEL}</FieldLabel>
                <Input
                  id={emailId}
                  type="email"
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                  aria-invalid={Boolean(errors.email)}
                  disabled={isPending}
                  {...form.register("email", {
                    required: STUDENT_FORM_MESSAGES.EMAIL_REQUIRED,
                    pattern: { value: /^\S+@\S+\.\S+$/, message: STUDENT_MESSAGES.INVALID_EMAIL },
                  })}
                />
                <FieldError id={`${emailId}-error`} errors={[errors.email]} />
              </Field>

              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor={phoneId}>{STUDENT_FORM_MESSAGES.PHONE_LABEL}</FieldLabel>
                <Input
                  id={phoneId}
                  type="tel"
                  maxLength={30}
                  aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                  aria-invalid={Boolean(errors.phone)}
                  disabled={isPending}
                  {...form.register("phone", {
                    maxLength: { value: 30, message: STUDENT_MESSAGES.PHONE_MAX_LENGTH },
                  })}
                />
                <FieldError id={`${phoneId}-error`} errors={[errors.phone]} />
              </Field>

              <Field data-invalid={Boolean(errors.date_of_birth)}>
                <FieldLabel htmlFor={dateOfBirthId}>{STUDENT_FORM_MESSAGES.DATE_OF_BIRTH_LABEL}</FieldLabel>
                <Input
                  id={dateOfBirthId}
                  type="date"
                  aria-describedby={errors.date_of_birth ? `${dateOfBirthId}-error` : undefined}
                  aria-invalid={Boolean(errors.date_of_birth)}
                  disabled={isPending}
                  {...form.register("date_of_birth", {
                    required: STUDENT_FORM_MESSAGES.DATE_OF_BIRTH_REQUIRED,
                    pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: STUDENT_FORM_MESSAGES.DATE_OF_BIRTH_INVALID },
                  })}
                />
                <FieldError id={`${dateOfBirthId}-error`} errors={[errors.date_of_birth]} />
              </Field>

              {/* Discipline enrollment — create mode only */}
              {!isEditing && disciplines.length > 0 && (
                <>
                  <Controller
                    control={form.control}
                    name="discipline_ids"
                    rules={{
                      validate: (value) =>
                        value.length >= 1 || ENROLLMENT_MESSAGES.MIN_ONE_DISCIPLINE,
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={Boolean(fieldState.error)}>
                        <FieldLabel>{ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}</FieldLabel>
                        <div className="flex flex-col gap-2" role="group" aria-label={ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}>
                          {disciplines.map((discipline) => {
                            const isChecked = field.value.includes(discipline.id)
                            return (
                              <label
                                key={discipline.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...field.value, discipline.id]
                                      : field.value.filter((id) => id !== discipline.id)
                                    field.onChange(next)
                                  }}
                                  disabled={isPending}
                                />
                                {discipline.name}
                              </label>
                            )
                          })}
                        </div>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />

                  <Field data-invalid={Boolean(errors.enrolled_at)}>
                    <FieldLabel htmlFor={enrolledAtId}>{ENROLLMENT_MESSAGES.ENROLLED_AT_LABEL}</FieldLabel>
                    <Input
                      id={enrolledAtId}
                      type="date"
                      max={getTodayString()}
                      aria-describedby={errors.enrolled_at ? `${enrolledAtId}-error` : undefined}
                      aria-invalid={Boolean(errors.enrolled_at)}
                      disabled={isPending}
                      {...form.register("enrolled_at")}
                    />
                    <FieldError id={`${enrolledAtId}-error`} errors={[errors.enrolled_at]} />
                  </Field>
                </>
              )}
            </FieldGroup>

            <SheetFooter>
              <SheetClose render={<Button type="button" variant="outline" disabled={isPending} />}>
                {COMMON_MESSAGES.CANCEL}
              </SheetClose>
              <Button type="submit" disabled={isPending}>
                {form.formState.isSubmitting ? STUDENT_FORM_MESSAGES.SAVING : submitLabel}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
