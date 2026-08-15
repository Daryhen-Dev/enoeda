"use client"

import { useState } from "react"
import { LoaderCircleIcon, ClipboardCheckIcon } from "lucide-react"

import { getAttendanceForSession } from "@/lib/domain/attendance/actions"
import type { EligibleStudentAttendance } from "@/lib/domain/attendance/actions"
import { AttendanceSheet } from "@/components/attendance/attendance-sheet"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  ATTENDANCE_FORM_MESSAGES,
  ATTENDANCE_MESSAGES,
  COMMON_MESSAGES,
} from "@/lib/localization/es-ec"

interface AttendanceSheetDialogProps {
  scheduledClassId: string
  sessionDate: string
  disabled?: boolean
}

export function AttendanceSheetDialog({
  scheduledClassId,
  sessionDate,
  disabled = false,
}: AttendanceSheetDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [students, setStudents] = useState<EligibleStudentAttendance[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  async function handleOpen(nextIsOpen: boolean) {
    setIsOpen(nextIsOpen)

    if (nextIsOpen) {
      setIsLoading(true)
      setLoadError(null)

      try {
        const result = await getAttendanceForSession({
          scheduled_class_id: scheduledClassId,
          session_date: sessionDate,
        })

        if (!result.success || !result.data) {
          setLoadError(result.error ?? ATTENDANCE_MESSAGES.LOAD_FAILURE)
          setStudents([])
          return
        }

        setStudents(result.data)
      } catch {
        setLoadError(ATTENDANCE_MESSAGES.LOAD_FAILURE)
        setStudents([])
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpen}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} />}
      >
        <ClipboardCheckIcon data-icon="inline-start" />
        {ATTENDANCE_FORM_MESSAGES.TAKE_ATTENDANCE}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{ATTENDANCE_FORM_MESSAGES.TITLE}</SheetTitle>
          <SheetDescription>
            {ATTENDANCE_FORM_MESSAGES.DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
              {COMMON_MESSAGES.LOADING}
            </p>
          ) : loadError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {loadError}
            </p>
          ) : (
            <AttendanceSheet
              scheduledClassId={scheduledClassId}
              sessionDate={sessionDate}
              students={students}
              onSuccess={() => setIsOpen(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
