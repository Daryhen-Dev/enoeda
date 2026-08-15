"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircleIcon, RotateCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { NoteRecord } from "@/lib/domain/progress/actions"
import { completeNote, reopenNote } from "@/lib/domain/progress/actions"
import {
  NOTES_MESSAGES,
  TOAST_MESSAGES,
  COMMON_MESSAGES,
  formatDate,
} from "@/lib/localization/es-ec"

const CATEGORY_LABELS: Record<string, string> = {
  tecnica: NOTES_MESSAGES.CATEGORY_TECNICA,
  fisico: NOTES_MESSAGES.CATEGORY_FISICO,
  actitud: NOTES_MESSAGES.CATEGORY_ACTITUD,
  medica: NOTES_MESSAGES.CATEGORY_MEDICA,
  general: NOTES_MESSAGES.CATEGORY_GENERAL,
}

type FilterState = "all" | "open" | "completed"

interface StudentNotesPanelProps {
  notes: NoteRecord[]
}

export function StudentNotesPanel({ notes }: StudentNotesPanelProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterState>("all")
  const [isPending, startTransition] = useTransition()

  const filteredNotes = notes.filter((note) => {
    if (filter === "open") return !note.is_completed
    if (filter === "completed") return note.is_completed
    return true
  })

  function handleComplete(noteId: string) {
    startTransition(async () => {
      const result = await completeNote({ id: noteId })
      if (result.success) {
        toast.success(TOAST_MESSAGES.NOTE_COMPLETED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleReopen(noteId: string) {
    startTransition(async () => {
      const result = await reopenNote({ id: noteId })
      if (result.success) {
        toast.success(TOAST_MESSAGES.NOTE_REOPENED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {NOTES_MESSAGES.PANEL_TITLE}
        </h2>
        <div className="flex gap-1">
          {(
            [
              ["all", NOTES_MESSAGES.FILTER_ALL],
              ["open", NOTES_MESSAGES.FILTER_OPEN],
              ["completed", NOTES_MESSAGES.FILTER_COMPLETED],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {NOTES_MESSAGES.EMPTY_STATE}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[note.category] ?? note.category}
                  </Badge>
                  {note.is_completed && (
                    <Badge variant="secondary" className="text-xs">
                      ✓
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{note.content}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(note.created_at))}
                </span>
              </div>
              <div className="flex gap-1">
                {!note.is_completed ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleComplete(note.id)}
                    disabled={isPending}
                    aria-label={NOTES_MESSAGES.COMPLETE_ACTION}
                  >
                    <CheckCircleIcon className="size-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleReopen(note.id)}
                    disabled={isPending}
                    aria-label={NOTES_MESSAGES.REOPEN_ACTION}
                  >
                    <RotateCcwIcon className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
