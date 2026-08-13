"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, LoaderCircleIcon, PowerOffIcon } from "lucide-react"

import { deactivateStudent } from "@/lib/domain/students/actions"
import { STUDENT_LIFECYCLE_MESSAGES } from "@/lib/localization/es-ec"
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
}

export function StudentDeactivateDialog({
  student,
}: StudentDeactivateDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const studentName = `${student.first_name} ${student.surname}`

  function handleOpenChange(nextIsOpen: boolean) {
    if (isDeactivating) {
      return
    }

    setIsOpen(nextIsOpen)
    setActionError(null)
  }

  async function handleDeactivate() {
    setActionError(null)
    setIsDeactivating(true)

    try {
      const result = await deactivateStudent(student.id)

      if (!result.success) {
        setActionError(result.error ?? STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_FAILURE)
        return
      }

      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError(STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_FAILURE)
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <PowerOffIcon aria-hidden="true" />
        {STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_TRIGGER}
      </AlertDialogTrigger>
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
