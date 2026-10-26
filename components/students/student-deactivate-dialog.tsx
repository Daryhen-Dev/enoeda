"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon, PowerOffIcon } from "lucide-react"

import {
  deactivateStudent,
  reactivateStudent,
} from "@/lib/domain/students/actions"
import {
  STUDENT_LIFECYCLE_MESSAGES,
  TOAST_MESSAGES,
  UNDO_MESSAGES,
} from "@/lib/localization/es-ec"
import { showUndoableAction } from "@/lib/notifications/undo-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

interface StudentDeactivateSummary {
  id: string
  first_name: string
  surname: string
}

interface StudentDeactivateDialogProps {
  student: StudentDeactivateSummary
  branchId: string
  /** Controlled open state; the built-in trigger keeps working when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Do not render the trigger button (the caller opens the dialog itself). */
  hideTrigger?: boolean
}

export function StudentDeactivateDialog({
  student,
  branchId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: StudentDeactivateDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const studentName = `${student.first_name} ${student.surname}`

  function requestOpenChange(nextIsOpen: boolean) {
    if (isControlled) {
      onOpenChange?.(nextIsOpen)
      return
    }

    setInternalOpen(nextIsOpen)
  }

  function handleOpenChange(nextIsOpen: boolean) {
    if (isDeactivating) {
      return
    }

    requestOpenChange(nextIsOpen)
    setActionError(null)
  }

  async function handleDeactivate() {
    setActionError(null)
    setIsDeactivating(true)

    try {
      const result = await deactivateStudent(student.id, branchId)

      if (!result.success) {
        setActionError(result.error ?? STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_FAILURE)
        return
      }

      requestOpenChange(false)
      showUndoableAction({
        message: TOAST_MESSAGES.STUDENT_DEACTIVATED,
        undoneMessage: UNDO_MESSAGES.STUDENT_DEACTIVATED_UNDONE,
        failedMessage: UNDO_MESSAGES.STUDENT_UNDO_FAILED,
        undo: async () => {
          const undoResult = await reactivateStudent({
            id: student.id,
            branch_id: branchId,
          })
          if (undoResult.success) router.refresh()
          return undoResult
        },
      })
      router.refresh()
    } catch {
      setActionError(STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_FAILURE)
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          <PowerOffIcon aria-hidden="true" />
          {STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_TRIGGER}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_CONFIRMATION_TITLE(studentName)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_ALERT_TITLE}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isDeactivating && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {STUDENT_LIFECYCLE_MESSAGES.DEACTIVATING}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeactivating}>
            {STUDENT_LIFECYCLE_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeactivating}
            onClick={handleDeactivate}
          >
            {isDeactivating
              ? STUDENT_LIFECYCLE_MESSAGES.DEACTIVATING
              : STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_TRIGGER}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
