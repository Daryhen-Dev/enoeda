"use client"

import { useState, useTransition, useEffect } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpIcon, Undo2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  getPromotionReadiness,
  promoteStudent,
  reverseLatestPromotion,
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
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [levelId, setLevelId] = useState<string>("")
  const [observations, setObservations] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isCorrecting, startCorrectionTransition] = useTransition()
  const selectedLevel = levels.find((level) => level.id === levelId) ?? null

  const [readiness, setReadiness] = useState<{
    attended: number
    required: number
    meets_requirement: boolean
  } | null>(null)

  useEffect(() => {
    if (!levelId || !open) return

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
    if (!levelId || readiness?.meets_requirement === false) return
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

  function handleCorrection() {
    startCorrectionTransition(async () => {
      setCorrectionError(null)
      const result = await reverseLatestPromotion({
        student_id: studentId,
        discipline_id: disciplineId,
        branch_id: branchId,
      })
      if (result.success) {
        setCorrectionOpen(false)
        toast.success(TOAST_MESSAGES.STUDENT_PROMOTION_CORRECTED)
        router.refresh()
      } else {
        setCorrectionError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
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
                <Select
                  value={levelId}
                  onValueChange={(value) => {
                    setLevelId(value ?? "")
                    setReadiness(null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={PROGRESS_MESSAGES.TARGET_LEVEL_PLACEHOLDER}
                    >
                      {selectedLevel
                        ? `${selectedLevel.sort_order}. ${selectedLevel.name}`
                        : null}
                    </SelectValue>
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
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder={PROGRESS_MESSAGES.OBSERVATIONS_PLACEHOLDER}
                  maxLength={500}
                />
              </Field>

              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>

            <Button
              type="submit"
              disabled={
                isPending || !levelId || readiness?.meets_requirement === false
              }
              className="self-start"
            >
              {isPending
                ? PROGRESS_MESSAGES.PROMOTING
                : PROGRESS_MESSAGES.PROMOTE_ACTION}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={correctionOpen}
        onOpenChange={(nextOpen) => {
          if (isCorrecting) return
          setCorrectionOpen(nextOpen)
          if (!nextOpen) setCorrectionError(null)
        }}
      >
        <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
          <Undo2Icon className="size-4" />
          {PROGRESS_MESSAGES.CORRECT_PROMOTION_ACTION}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{PROGRESS_MESSAGES.CORRECT_PROMOTION_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>
              {PROGRESS_MESSAGES.CORRECT_PROMOTION_DESCRIPTION} ({disciplineName})
            </AlertDialogDescription>
          </AlertDialogHeader>

          {correctionError && <FieldError role="alert">{correctionError}</FieldError>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCorrecting}>
              {COMMON_MESSAGES.CANCEL}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isCorrecting}
              onClick={handleCorrection}
            >
              {isCorrecting
                ? PROGRESS_MESSAGES.CORRECTING_PROMOTION
                : PROGRESS_MESSAGES.CORRECT_PROMOTION_ACTION}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
