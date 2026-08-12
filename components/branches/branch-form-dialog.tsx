"use client"

import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, PencilIcon, PlusIcon } from "lucide-react"

import {
  createBranch,
  type BranchRecord,
  updateBranch,
} from "@/lib/domain/branches/actions"
import {
  ECUADOR_TIME_ZONES,
  type EcuadorTimeZone,
} from "@/lib/domain/branches/schema"
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

const TIME_ZONE_OPTIONS = [
  {
    value: ECUADOR_TIME_ZONES.CONTINENTAL,
    label: "Continental Ecuador — America/Guayaquil (UTC−5)",
  },
  {
    value: ECUADOR_TIME_ZONES.GALAPAGOS,
    label: "Galápagos — Pacific/Galapagos (UTC−6)",
  },
] as const

interface BranchFormValues {
  name: string
  address: string
  phone: string
  time_zone: EcuadorTimeZone
}

interface BranchFormDialogProps {
  branch?: BranchRecord
}

function getDefaultValues(branch?: BranchRecord): BranchFormValues {
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    time_zone: branch?.time_zone ?? ECUADOR_TIME_ZONES.CONTINENTAL,
  }
}

function toOptionalValue(value: string): string | undefined {
  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : undefined
}

function toNullableValue(value: string): string | null {
  return toOptionalValue(value) ?? null
}

export function BranchFormDialog({ branch }: BranchFormDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const nameId = useId()
  const addressId = useId()
  const phoneId = useId()
  const timeZoneId = useId()
  const form = useForm<BranchFormValues>({
    defaultValues: getDefaultValues(branch),
    mode: "onBlur",
  })
  const isEditing = branch !== undefined
  const title = isEditing ? "Edit branch" : "Create branch"
  const submitLabel = isEditing ? "Save changes" : "Create branch"

  function handleOpenChange(nextIsOpen: boolean) {
    if (form.formState.isSubmitting) {
      return
    }

    setIsOpen(nextIsOpen)
    setActionError(null)
    form.reset(getDefaultValues(branch))
  }

  async function handleSubmit(values: BranchFormValues) {
    setActionError(null)

    try {
      const result = branch
        ? await updateBranch({
            id: branch.id,
            name: values.name,
            address: toNullableValue(values.address),
            phone: toNullableValue(values.phone),
            time_zone: values.time_zone,
          })
        : await createBranch({
            name: values.name,
            address: toOptionalValue(values.address),
            phone: toOptionalValue(values.phone),
            time_zone: values.time_zone,
          })

      if (!result.success) {
        setActionError(result.error ?? "Unable to save the branch.")
        return
      }

      form.reset(getDefaultValues(branch))
      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError("Unable to save the branch.")
    }
  }

  const { errors, isSubmitting } = form.formState

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={isEditing ? "outline" : "default"} size="sm" />
        }
      >
        {isEditing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {isEditing ? "Edit" : "Create branch"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this branch's location and contact details."
              : "Add a new academy location to the directory."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
          {actionError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Unable to save branch</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                aria-invalid={Boolean(errors.name)}
                disabled={isSubmitting}
                {...form.register("name", {
                  required: "Branch name is required",
                  maxLength: {
                    value: 100,
                    message: "Branch name must be 100 characters or less",
                  },
                })}
              />
              <FieldError id={`${nameId}-error`} errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor={addressId}>Address</FieldLabel>
              <Input
                id={addressId}
                aria-describedby={
                  errors.address ? `${addressId}-error` : undefined
                }
                aria-invalid={Boolean(errors.address)}
                disabled={isSubmitting}
                {...form.register("address", {
                  maxLength: {
                    value: 255,
                    message: "Address must be 255 characters or less",
                  },
                })}
              />
              <FieldError
                id={`${addressId}-error`}
                errors={[errors.address]}
              />
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
              <Input
                id={phoneId}
                aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                aria-invalid={Boolean(errors.phone)}
                disabled={isSubmitting}
                {...form.register("phone", {
                  maxLength: {
                    value: 30,
                    message: "Phone must be 30 characters or less",
                  },
                })}
              />
              <FieldError id={`${phoneId}-error`} errors={[errors.phone]} />
            </Field>

            <Controller
              control={form.control}
              name="time_zone"
              rules={{ required: "Time zone is required" }}
              render={({ field, fieldState }) => (
                <Field data-invalid={Boolean(fieldState.error)}>
                  <FieldLabel htmlFor={timeZoneId}>Time zone</FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) {
                        field.onChange(value)
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      id={timeZoneId}
                      className="w-full"
                      aria-describedby={
                        fieldState.error ? `${timeZoneId}-error` : undefined
                      }
                      aria-invalid={Boolean(fieldState.error)}
                    >
                      <SelectValue placeholder="Select a time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ZONE_OPTIONS.map((timeZone) => (
                        <SelectItem key={timeZone.value} value={timeZone.value}>
                          {timeZone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    id={`${timeZoneId}-error`}
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
