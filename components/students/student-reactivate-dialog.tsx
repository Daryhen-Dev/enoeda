"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deactivateStudent, reactivateStudent } from "@/lib/domain/students/actions"
import {
  STUDENT_LIFECYCLE_MESSAGES,
  TOAST_MESSAGES,
  UNDO_MESSAGES,
} from "@/lib/localization/es-ec"
import { showUndoableAction } from "@/lib/notifications/undo-toast"

interface ReactivateStudentSummary {
  id: string
  branch_id: string
}

interface StudentReactivateDialogProps {
  student: ReactivateStudentSummary
  branches: ActiveBranchOption[]
  callerBranchId: string
  /** Controlled open state; the built-in trigger keeps working when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Do not render the trigger button (the caller opens the dialog itself). */
  hideTrigger?: boolean
}

export function StudentReactivateDialog({
  student,
  branches,
  callerBranchId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: StudentReactivateDialogProps) {
  const router = useRouter()
  const branchSelectId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen
  const [isPending, setIsPending] = useState(false)
  const [branchId, setBranchId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const requiresBranch = !branches.some((branch) => branch.id === student.branch_id)

  function requestOpenChange(nextIsOpen: boolean) {
    if (isControlled) {
      onOpenChange?.(nextIsOpen)
      return
    }

    setInternalOpen(nextIsOpen)
  }

  function setDialogOpen(open: boolean) {
    if (isPending) return
    requestOpenChange(open)
    setBranchId("")
    setError(null)
  }

  async function handleReactivate() {
    if (requiresBranch && !branchId) {
      setError(STUDENT_LIFECYCLE_MESSAGES.REACTIVATION_BRANCH_REQUIRED)
      return
    }

    setError(null)
    setIsPending(true)
    try {
      const result = await reactivateStudent({
        id: student.id,
        ...(requiresBranch ? { branch_id: branchId } : {}),
      }, callerBranchId)
      if (!result.success) {
        setError(result.error ?? STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_FAILURE)
        return
      }
      requestOpenChange(false)
      showUndoableAction({
        message: TOAST_MESSAGES.STUDENT_REACTIVATED,
        undoneMessage: UNDO_MESSAGES.STUDENT_REACTIVATED_UNDONE,
        failedMessage: UNDO_MESSAGES.STUDENT_UNDO_FAILED,
        undo: async () => {
          const undoResult = await deactivateStudent(student.id, callerBranchId)
          if (undoResult.success) router.refresh()
          return undoResult
        },
      })
      router.refresh()
    } catch {
      setError(STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_FAILURE)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger && (
        <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
          {STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_TRIGGER}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_CONFIRMATION_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>
            {STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requiresBranch && (
          <Field>
            <FieldLabel htmlFor={branchSelectId}>
              {STUDENT_LIFECYCLE_MESSAGES.ACTIVE_BRANCH_LABEL}
            </FieldLabel>
            <Select value={branchId} onValueChange={(value) => setBranchId(value ?? "")} disabled={isPending}>
              <SelectTrigger id={branchSelectId} className="w-full"><SelectValue placeholder={STUDENT_LIFECYCLE_MESSAGES.ACTIVE_BRANCH_PLACEHOLDER} /></SelectTrigger>
              <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {isPending && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{STUDENT_LIFECYCLE_MESSAGES.REACTIVATING}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{STUDENT_LIFECYCLE_MESSAGES.CANCEL}</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleReactivate}>{isPending ? STUDENT_LIFECYCLE_MESSAGES.REACTIVATING : STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_ACTION}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
