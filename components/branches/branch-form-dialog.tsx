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
import { COMMON_MESSAGES, PRODUCT_TERMS } from "@/lib/localization/es-ec"

const TIME_ZONE_OPTIONS = [
  {
    value: ECUADOR_TIME_ZONES.CONTINENTAL,
    label: "Ecuador continental — America/Guayaquil (UTC−5)",
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
  const title = isEditing
    ? `${COMMON_MESSAGES.EDIT} ${PRODUCT_TERMS.BRANCH.toLowerCase()}`
    : `${COMMON_MESSAGES.CREATE} ${PRODUCT_TERMS.BRANCH.toLowerCase()}`
  const submitLabel = isEditing ? "Guardar cambios" : title

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
            is_active: true,
          })

      if (!result.success) {
        setActionError(
          result.error ?? `No se pudo guardar la ${PRODUCT_TERMS.BRANCH.toLowerCase()}.`
        )
        return
      }

      form.reset(getDefaultValues(branch))
      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError(
        `No se pudo guardar la ${PRODUCT_TERMS.BRANCH.toLowerCase()}.`
      )
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
        {isEditing ? COMMON_MESSAGES.EDIT : title}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Actualice la ubicación y los datos de contacto de esta sucursal."
              : "Agregue una nueva ubicación de la academia al directorio."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
          {actionError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>No se pudo guardar la sucursal</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={nameId}>Nombre</FieldLabel>
              <Input
                id={nameId}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                aria-invalid={Boolean(errors.name)}
                disabled={isSubmitting}
                {...form.register("name", {
                  required: "El nombre de la sucursal es obligatorio",
                  maxLength: {
                    value: 100,
                    message: "El nombre de la sucursal debe tener máximo 100 caracteres",
                  },
                })}
              />
              <FieldError id={`${nameId}-error`} errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor={addressId}>Dirección</FieldLabel>
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
                    message: "La dirección debe tener máximo 255 caracteres",
                  },
                })}
              />
              <FieldError
                id={`${addressId}-error`}
                errors={[errors.address]}
              />
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor={phoneId}>Teléfono</FieldLabel>
              <Input
                id={phoneId}
                aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                aria-invalid={Boolean(errors.phone)}
                disabled={isSubmitting}
                {...form.register("phone", {
                  maxLength: {
                    value: 30,
                    message: "El teléfono debe tener máximo 30 caracteres",
                  },
                })}
              />
              <FieldError id={`${phoneId}-error`} errors={[errors.phone]} />
            </Field>

            <Controller
              control={form.control}
              name="time_zone"
              rules={{ required: "La zona horaria es obligatoria" }}
              render={({ field, fieldState }) => (
                <Field data-invalid={Boolean(fieldState.error)}>
                  <FieldLabel htmlFor={timeZoneId}>Zona horaria</FieldLabel>
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
                      <SelectValue placeholder="Seleccione una zona horaria" />
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
              {COMMON_MESSAGES.CANCEL}
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
