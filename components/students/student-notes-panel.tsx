"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircleIcon, RotateCcwIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { NoteRecord } from "@/lib/domain/progress/actions"
import { completeNote, reopenNote } from "@/lib/domain/progress/actions"
import {
  COMMON_MESSAGES,
  formatDate,
  formatDateTime,
  NOTES_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

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
  branchId: string
}

export function StudentNotesPanel({ notes, branchId }: StudentNotesPanelProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterState>("open")
  const [noteToReopen, setNoteToReopen] = useState<NoteRecord | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredNotes = notes.filter((note) => {
    if (filter === "open") return !note.is_completed
    if (filter === "completed") return note.is_completed
    return true
  })

  function handleComplete(noteId: string) {
    startTransition(async () => {
      const result = await completeNote({ id: noteId, branch_id: branchId })
      if (result.success) {
        toast.success(TOAST_MESSAGES.NOTE_COMPLETED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleReopen() {
    if (!noteToReopen) return

    startTransition(async () => {
      const result = await reopenNote({
        id: noteToReopen.id,
        branch_id: branchId,
      })
      if (result.success) {
        setNoteToReopen(null)
        toast.success(TOAST_MESSAGES.NOTE_REOPENED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleReopenDialogOpenChange(open: boolean) {
    if (!open && !isPending) {
      setNoteToReopen(null)
    }
  }

  return (
    <section className="flex w-full flex-col gap-3">
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
        <div className="grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "flex h-full items-start gap-3 rounded-md border p-3",
                note.is_completed && "bg-green-50 dark:bg-green-950/30"
              )}
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
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    {NOTES_MESSAGES.CREATED_AT_LABEL}: {formatDate(new Date(note.created_at))}
                  </span>
                  <span>
                    {NOTES_MESSAGES.LAST_UPDATED_AT_LABEL}: {formatDateTime(new Date(note.updated_at))}
                  </span>
                </div>
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
                    onClick={() => setNoteToReopen(note)}
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

      <AlertDialog
        open={noteToReopen !== null}
        onOpenChange={handleReopenDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {NOTES_MESSAGES.REOPEN_CONFIRMATION_TITLE}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {NOTES_MESSAGES.REOPEN_CONFIRMATION_DESCRIPTION}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isPending && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {NOTES_MESSAGES.REOPENING}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {COMMON_MESSAGES.CANCEL}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isPending || noteToReopen === null}
              onClick={handleReopen}
            >
              {isPending
                ? NOTES_MESSAGES.REOPENING
                : NOTES_MESSAGES.REOPEN_CONFIRM_ACTION}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
