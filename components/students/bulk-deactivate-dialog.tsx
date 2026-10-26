"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react"

import {
  deactivateStudents,
  reactivateStudent,
} from "@/lib/domain/students/actions"
import {
  COMMON_MESSAGES,
  STUDENT_BULK_ACTIONS_MESSAGES,
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
} from "@/components/ui/alert-dialog"

/** How many names the confirmation spells out before it counts the rest. */
const VISIBLE_STUDENT_NAMES = 3

interface BulkDeactivateStudentSummary {
  id: string
  first_name: string
  surname: string
}

interface BulkDeactivateDialogProps {
  students: BulkDeactivateStudentSummary[]
  branchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful batch so the directory can clear its selection. */
  onDeactivated: () => void
}

/**
 * Confirmation of one bulk deactivation (S4). It is the multi-row twin of
 * StudentDeactivateDialog: same destructive confirmation, same server-side
 * authorization, and the same undo affordance — the inverse is one reactivation
 * per selected student, so undoing a batch walks the batch back.
 */
export function BulkDeactivateDialog({
  students,
  branchId,
  open,
  onOpenChange,
  onDeactivated,
}: BulkDeactivateDialogProps) {
  const router = useRouter()
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const studentIds = students.map((student) => student.id)
  const studentNames = students.map(
    (student) => `${student.first_name} ${student.surname}`
  )
  const visibleNames = studentNames.slice(0, VISIBLE_STUDENT_NAMES)
  const remainingStudents = studentNames.length - visibleNames.length

  function handleOpenChange(nextOpen: boolean) {
    if (isDeactivating) {
      return
    }

    onOpenChange(nextOpen)
    setActionError(null)
  }

  async function handleDeactivate() {
    setActionError(null)
    setIsDeactivating(true)

    try {
      const result = await deactivateStudents({
        student_ids: studentIds,
        branch_id: branchId,
      })

      if (!result.success) {
        setActionError(
          result.error ?? STUDENT_BULK_ACTIONS_MESSAGES.FAILURE
        )
        return
      }

      const deactivatedCount = result.data?.deactivated ?? studentIds.length

      showUndoableAction({
        message: STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATED(deactivatedCount),
        undoneMessage: UNDO_MESSAGES.STUDENT_DEACTIVATED_UNDONE,
        failedMessage: UNDO_MESSAGES.STUDENT_UNDO_FAILED,
        undo: async () => {
          const undoResults = await Promise.all(
            studentIds.map((id) =>
              reactivateStudent({ id, branch_id: branchId })
            )
          )
          const failedUndo = undoResults.find((undoResult) => !undoResult.success)

          if (failedUndo !== undefined) {
            return { success: false, error: failedUndo.error }
          }

          router.refresh()
          return { success: true }
        },
      })

      onOpenChange(false)
      onDeactivated()
      router.refresh()
    } catch {
      setActionError(STUDENT_BULK_ACTIONS_MESSAGES.FAILURE)
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_TITLE(studentIds.length)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="text-sm text-muted-foreground">
          {STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_NAMES(
            visibleNames,
            remainingStudents
          )}
        </p>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>
              {STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_ALERT_TITLE}
            </AlertTitle>
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
            {STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATING_SELECTED}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeactivating}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeactivating || studentIds.length === 0}
            onClick={handleDeactivate}
          >
            {isDeactivating
              ? STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATING_SELECTED
              : STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
