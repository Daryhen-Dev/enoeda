"use client"

import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MAX_FINE_AMOUNT, CONDUCT_KINDS } from "@/lib/domain/conduct"
import {
  buildConductFormSchema,
  submitConductForm,
  type ConductFormValues,
} from "@/components/conduct/conduct-form"
import {
  COMMON_MESSAGES,
  CONDUCT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface CreateConductRecordDialogProps {
  studentId: string
  branchId: string
  /** Branch-timezone today (YYYY-MM-DD); default and max for the incident date. */
  todayDateOnly: string
}

/**
 * Register a fine or a warning for a student. Mirrors CreateNoteDialog:
 * Sheet form, sonner toasts, router refresh after success.
 */
export function CreateConductRecordDialog({
  studentId,
  branchId,
  todayDateOnly,
}: CreateConductRecordDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const kindId = useId()
  const reasonId = useId()
  const incidentDateId = useId()
  const amountId = useId()

  const form = useForm<ConductFormValues>({
    resolver: zodResolver(buildConductFormSchema(todayDateOnly)),
    defaultValues: {
      kind: "",
      reason: "",
      incident_date: todayDateOnly,
      amount: "",
    },
    mode: "onSubmit",
  })
  const isPending = form.formState.isSubmitting

  function resetForm() {
    form.reset({
      kind: "",
      reason: "",
      incident_date: todayDateOnly,
      amount: "",
    })
    setSubmitError(null)
  }

  async function handleSubmit(values: ConductFormValues) {
    setSubmitError(null)
    const result = await submitConductForm(values, studentId, branchId)

    if (result.success) {
      setOpen(false)
      resetForm()
      toast.success(TOAST_MESSAGES.CONDUCT_CREATED)
      router.refresh()
    } else {
      setSubmitError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        {CONDUCT_MESSAGES.REGISTER_ACTION}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{CONDUCT_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>
            {CONDUCT_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="kind"
              render={({ field, fieldState }) => (
                <>
                  <Field data-invalid={Boolean(fieldState.error)}>
                    <FieldLabel htmlFor={kindId}>
                      {CONDUCT_MESSAGES.KIND_FIELD_LABEL}
                    </FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value ?? "")
                        form.clearErrors("amount")
                      }}
                    >
                      <SelectTrigger id={kindId} className="w-full">
                        <SelectValue
                          placeholder={CONDUCT_MESSAGES.KIND_PLACEHOLDER}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CONDUCT_KINDS.FINE}>
                          {CONDUCT_MESSAGES.KIND_FINE}
                        </SelectItem>
                        <SelectItem value={CONDUCT_KINDS.WARNING}>
                          {CONDUCT_MESSAGES.KIND_WARNING}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>

                  {/* Amount applies to fines only. */}
                  {field.value === CONDUCT_KINDS.FINE && (
                    <Field
                      data-invalid={Boolean(form.formState.errors.amount)}
                    >
                      <FieldLabel htmlFor={amountId}>
                        {CONDUCT_MESSAGES.AMOUNT_FIELD_LABEL}
                      </FieldLabel>
                      <Input
                        id={amountId}
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={MAX_FINE_AMOUNT}
                        {...form.register("amount")}
                        placeholder="0.00"
                        aria-invalid={Boolean(form.formState.errors.amount)}
                        disabled={isPending}
                      />
                      {form.formState.errors.amount && (
                        <FieldError>
                          {form.formState.errors.amount.message}
                        </FieldError>
                      )}
                    </Field>
                  )}
                </>
              )}
 />

            <Field
              data-invalid={Boolean(form.formState.errors.reason)}
            >
              <FieldLabel htmlFor={reasonId}>
                {CONDUCT_MESSAGES.REASON_FIELD_LABEL}
              </FieldLabel>
              <textarea
                id={reasonId}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
                {...form.register("reason")}
                placeholder={CONDUCT_MESSAGES.REASON_PLACEHOLDER}
                maxLength={2000}
                aria-invalid={Boolean(form.formState.errors.reason)}
                disabled={isPending}
              />
              {form.formState.errors.reason && (
                <FieldError>
                  {form.formState.errors.reason.message}
                </FieldError>
              )}
            </Field>

            <Field
              data-invalid={Boolean(form.formState.errors.incident_date)}
            >
              <FieldLabel htmlFor={incidentDateId}>
                {CONDUCT_MESSAGES.INCIDENT_DATE_FIELD_LABEL}
              </FieldLabel>
              <Input
                id={incidentDateId}
                type="date"
                max={todayDateOnly}
                {...form.register("incident_date")}
                aria-invalid={Boolean(form.formState.errors.incident_date)}
                disabled={isPending}
              />
              {form.formState.errors.incident_date && (
                <FieldError>
                  {form.formState.errors.incident_date.message}
                </FieldError>
              )}
            </Field>

            {submitError && <FieldError>{submitError}</FieldError>}
          </FieldGroup>

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? CONDUCT_MESSAGES.SAVING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
