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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createNote } from "@/lib/domain/progress/actions"
import type { NoteCategory } from "@/lib/domain/progress/schema"
import { NOTE_CATEGORIES } from "@/lib/domain/progress/schema"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  NOTES_MESSAGES,
} from "@/lib/localization/es-ec"

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  tecnica: NOTES_MESSAGES.CATEGORY_TECNICA,
  fisico: NOTES_MESSAGES.CATEGORY_FISICO,
  actitud: NOTES_MESSAGES.CATEGORY_ACTITUD,
  medica: NOTES_MESSAGES.CATEGORY_MEDICA,
  general: NOTES_MESSAGES.CATEGORY_GENERAL,
}

interface DisciplineOption {
  id: string
  name: string
}

/** Sentinel value for the "no discipline / general" option — Select items cannot use an empty string value. */
const NO_DISCIPLINE_VALUE = "__none__"

interface CreateNoteDialogProps {
  studentId: string
  disciplines: DisciplineOption[]
  branchId: string
}

export function CreateNoteDialog({
  studentId,
  disciplines,
  branchId,
}: CreateNoteDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>("")
  const [content, setContent] = useState("")
  const [disciplineId, setDisciplineId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setCategory("")
    setContent("")
    setDisciplineId("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!category) return
    startTransition(async () => {
      const result = await createNote({
        student_id: studentId,
        discipline_id:
          disciplineId && disciplineId !== NO_DISCIPLINE_VALUE
            ? disciplineId
            : null,
        category: category as NoteCategory,
        content,
        branch_id: branchId,
      })
      if (result.success) {
        setOpen(false)
        resetForm()
        toast.success(TOAST_MESSAGES.NOTE_CREATED)
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
        <PlusIcon className="size-4" />
        {NOTES_MESSAGES.CREATE_NOTE}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{NOTES_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>
            {NOTES_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>{NOTES_MESSAGES.CATEGORY_LABEL}</FieldLabel>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={NOTES_MESSAGES.CATEGORY_PLACEHOLDER}
                  />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{NOTES_MESSAGES.DISCIPLINE_LABEL}</FieldLabel>
              <Select value={disciplineId} onValueChange={(v) => setDisciplineId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <span data-slot="select-value" className="min-w-0 flex-1 truncate text-left">
                    {disciplineId && disciplineId !== NO_DISCIPLINE_VALUE
                      ? disciplines.find((discipline) => discipline.id === disciplineId)
                          ?.name ?? NOTES_MESSAGES.DISCIPLINE_PLACEHOLDER
                      : NOTES_MESSAGES.DISCIPLINE_PLACEHOLDER}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DISCIPLINE_VALUE}>
                    {NOTES_MESSAGES.DISCIPLINE_PLACEHOLDER}
                  </SelectItem>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="note-content">
                {NOTES_MESSAGES.CONTENT_LABEL}
              </FieldLabel>
              <Input
                id="note-content"
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={NOTES_MESSAGES.CONTENT_PLACEHOLDER}
                required
                maxLength={2000}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || !category || !content}
            className="self-start"
          >
            {isPending ? NOTES_MESSAGES.SAVING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
