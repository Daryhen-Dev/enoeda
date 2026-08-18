"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { setBranchDefaultTeacher } from "@/lib/domain/roles/actions"
import type { TeacherOption } from "@/lib/domain/roles/actions"
import { COMMON_MESSAGES } from "@/lib/localization/es-ec"

const MESSAGES = {
  LABEL: "Profesor predeterminado",
  PLACEHOLDER: "Seleccionar profesor…",
  SAVE: "Guardar",
  SAVING: "Guardando…",
  SAVED: "Profesor predeterminado actualizado.",
} as const

interface DefaultTeacherSelectorProps {
  branchId: string
  teachers: TeacherOption[]
  currentDefaultId?: string | null
}

/**
 * Branch default teacher selector — dropdown filtered to active same-branch
 * teachers (data provided by server via listBranchTeacherOptions). Calls
 * setBranchDefaultTeacher server action on save.
 */
export function DefaultTeacherSelector({ branchId, teachers, currentDefaultId }: DefaultTeacherSelectorProps) {
  const [selected, setSelected] = useState(currentDefaultId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!selected) return
    startTransition(async () => {
      setError(null)
      const result = await setBranchDefaultTeacher({ branchId, teacherId: selected })
      if (result.success) toast.success(MESSAGES.SAVED)
      else setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
    })
  }

  return (
    <FieldGroup>
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="default-teacher-select">{MESSAGES.LABEL}</FieldLabel>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={(value) => { if (value) setSelected(value) }}>
            <SelectTrigger id="default-teacher-select" className="w-64">
              <SelectValue placeholder={MESSAGES.PLACEHOLDER} />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={isPending || !selected || selected === currentDefaultId} onClick={handleSave}>
            {isPending ? MESSAGES.SAVING : MESSAGES.SAVE}
          </Button>
        </div>
        {error && <FieldError id="default-teacher-error">{error}</FieldError>}
      </Field>
    </FieldGroup>
  )
}
