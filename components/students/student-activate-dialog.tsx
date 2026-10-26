"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, CheckIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

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
import { activateStudent } from "@/lib/domain/students"
import { STUDENT_LIFECYCLE_MESSAGES } from "@/lib/localization/es-ec"

interface StudentActivateSummary {
  id: string
  first_name: string
  surname: string
}

interface StudentActivateDialogProps {
  student: StudentActivateSummary
  branchId: string
  onActivated: () => void
  /** Controlled open state; the built-in trigger keeps working when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Do not render the trigger button (the caller opens the dialog itself). */
  hideTrigger?: boolean
}

export function StudentActivateDialog({
  student,
  branchId,
  onActivated,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: StudentActivateDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen
  const [isActivating, setIsActivating] = useState(false)
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
    if (isActivating) {
      return
    }

    requestOpenChange(nextIsOpen)
    setActionError(null)
  }

  async function handleActivate() {
    setActionError(null)
    setIsActivating(true)

    try {
      const result = await activateStudent(student.id, branchId)

      if (!result.success) {
        setActionError(result.error ?? STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_FAILURE)
        return
      }

      requestOpenChange(false)
      toast.success(STUDENT_LIFECYCLE_MESSAGES.ACTIVATION_SUCCESS)
      onActivated()
      router.refresh()
    } catch {
      setActionError(STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_FAILURE)
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <AlertDialogTrigger render={<Button size="sm" />}>
          <CheckIcon aria-hidden="true" />
          {STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_TRIGGER}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_CONFIRMATION_TITLE(studentName)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_ALERT_TITLE}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isActivating && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {STUDENT_LIFECYCLE_MESSAGES.ACTIVATING}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActivating}>
            {STUDENT_LIFECYCLE_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isActivating}
            onClick={handleActivate}
          >
            {isActivating
              ? STUDENT_LIFECYCLE_MESSAGES.ACTIVATING
              : STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_TRIGGER}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
