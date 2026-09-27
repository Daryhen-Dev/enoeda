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
}

export function StudentActivateDialog({
  student,
  branchId,
  onActivated,
}: StudentActivateDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const studentName = `${student.first_name} ${student.surname}`

  function handleOpenChange(nextIsOpen: boolean) {
    if (isActivating) {
      return
    }

    setIsOpen(nextIsOpen)
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

      setIsOpen(false)
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
      <AlertDialogTrigger render={<Button size="sm" />}>
        <CheckIcon aria-hidden="true" />
        {STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_TRIGGER}
      </AlertDialogTrigger>
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
