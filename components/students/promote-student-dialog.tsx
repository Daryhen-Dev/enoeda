"use client"

import { useState, useTransition, useEffect } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpIcon } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import {
  promoteStudent,
  getPromotionReadiness,
} from "@/lib/domain/progress/actions"
import type { LevelRecord } from "@/lib/domain/levels/actions"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  PROGRESS_MESSAGES,
} from "@/lib/localization/es-ec"

interface PromoteStudentDialogProps {
  studentId: string
  disciplineId: string
  disciplineName: string
  levels: LevelRecord[]
  branchId: string
}

export function PromoteStudentDialog({
  studentId,
  disciplineId,
  disciplineName,
  levels,
  branchId,
}: PromoteStudentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [levelId, setLevelId] = useState<string>("")
  const [observations, setObservations] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Readiness indicator
  const [readiness, setReadiness] = useState<{
    attended: number
    required: number
    meets_requirement: boolean
  } | null>(null)

  useEffect(() => {
    if (!levelId || !open) {
      setReadiness(null)
      return
    }
    let cancelled = false
    getPromotionReadiness({
      student_id: studentId,
      discipline_id: disciplineId,
      level_id: levelId,
      branch_id: branchId,
    }).then((result) => {
      if (!cancelled && result.success && result.data) {
        setReadiness(result.data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [levelId, open, studentId, disciplineId, branchId])

  function resetForm() {
    setLevelId("")
    setObservations("")
    setError(null)
    setReadiness(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!levelId) return
    startTransition(async () => {
      const result = await promoteStudent({
        student_id: studentId,
        discipline_id: disciplineId,
        level_id: levelId,
        branch_id: branchId,
        observations: observations || null,
      })
      if (result.success) {
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.STUDENT_PROMOTED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
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
        <ArrowUpIcon className="size-4" />
        {PROGRESS_MESSAGES.PROMOTE_ACTION}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{PROGRESS_MESSAGES.PROMOTE_TITLE}</SheetTitle>
          <SheetDescription>
            {PROGRESS_MESSAGES.PROMOTE_DESCRIPTION} ({disciplineName})
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>{PROGRESS_MESSAGES.TARGET_LEVEL_LABEL}</FieldLabel>
              <Select value={levelId} onValueChange={(v) => setLevelId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={PROGRESS_MESSAGES.TARGET_LEVEL_PLACEHOLDER}
                  />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.sort_order}. {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Readiness indicator */}
            {readiness && (
              <div className="rounded-md border p-3 text-sm">
                <Badge
                  variant={readiness.meets_requirement ? "default" : "secondary"}
                >
                  {readiness.meets_requirement
                    ? PROGRESS_MESSAGES.READINESS_MEETS
                    : PROGRESS_MESSAGES.READINESS_NOT_MEETS}
                </Badge>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>
                    {PROGRESS_MESSAGES.ATTENDED_LABEL}: {readiness.attended}
                  </span>
                  <span>
                    {PROGRESS_MESSAGES.REQUIRED_LABEL}: {readiness.required}
                  </span>
                </div>
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="promote-observations">
                {PROGRESS_MESSAGES.OBSERVATIONS_LABEL}
              </FieldLabel>
              <Input
                id="promote-observations"
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder={PROGRESS_MESSAGES.OBSERVATIONS_PLACEHOLDER}
                maxLength={500}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || !levelId}
            className="self-start"
          >
            {isPending
              ? PROGRESS_MESSAGES.PROMOTING
              : PROGRESS_MESSAGES.PROMOTE_ACTION}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
