"use client"

import { useEffect, useState } from "react"

import { getPresentStudentsForSession, type PresentStudent } from "@/lib/domain/attendance/actions"
import type { SessionView } from "@/lib/domain/classes/actions"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SESSION_INFO_MESSAGES } from "@/lib/localization/es-ec"

interface SessionInfoSheetDialogProps {
  session: SessionView
  branchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionInfoSheetDialog({
  session,
  branchId,
  open,
  onOpenChange,
}: SessionInfoSheetDialogProps) {
  const [students, setStudents] = useState<PresentStudent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const isSuspended = session.status === "suspended"
  const hasAttendanceRecords = session.attendance.record_count > 0

  useEffect(() => {
    if (!open || isSuspended || !hasAttendanceRecords || !branchId) return;

    let cancelled = false

    async function loadPresentStudents() {
      await Promise.resolve()
      if (cancelled) return

      setIsLoading(true)
      setLoadError(null)

      try {
        const result = await getPresentStudentsForSession(
          session.is_one_time
            ? { one_time_class_id: session.scheduled_class_id, branch_id: branchId }
            : {
                scheduled_class_id: session.scheduled_class_id,
                session_date: session.session_date,
                branch_id: branchId,
              }
        )


        if (cancelled) return
        if (!result.success || !result.data) {
          setStudents([])
          setLoadError(result.error ?? SESSION_INFO_MESSAGES.PRESENT_STUDENTS_ERROR)
          return
        }

        setStudents(result.data)
      } catch {
        if (!cancelled) {
          setStudents([])
          setLoadError(SESSION_INFO_MESSAGES.PRESENT_STUDENTS_ERROR)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPresentStudents()

    return () => {
      cancelled = true
    }
  }, [
    branchId,
    hasAttendanceRecords,
    isSuspended,
    open,
    session.is_one_time,
    session.scheduled_class_id,
    session.session_date,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{SESSION_INFO_MESSAGES.TITLE}</SheetTitle>
          <SheetDescription>{SESSION_INFO_MESSAGES.DESCRIPTION}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.DISCIPLINE_LABEL}</dt><dd className="text-muted-foreground">{session.discipline_name}</dd></div>
            <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.DATE_LABEL}</dt><dd className="text-muted-foreground">{session.session_date}</dd></div>
            <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.SCHEDULE_LABEL}</dt><dd className="text-muted-foreground">{session.start_time}–{session.end_time}</dd></div>
            <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.TEACHER_LABEL}</dt><dd className="text-muted-foreground">{session.teacher_id ? session.effective_teacher_name ?? SESSION_INFO_MESSAGES.TEACHER_PROFILE_UNAVAILABLE : SESSION_INFO_MESSAGES.NO_TEACHER}</dd></div>
            {session.is_substitute && <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.SUBSTITUTE_LABEL}</dt><dd className="text-muted-foreground">{SESSION_INFO_MESSAGES.SUBSTITUTE_VALUE}</dd></div>}
            {session.is_one_time && <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.ONE_TIME_TYPE_LABEL}</dt><dd className="text-muted-foreground">{SESSION_INFO_MESSAGES.ONE_TIME_TYPE_VALUE}</dd></div>}
            <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.STATUS_LABEL}</dt><dd className="text-muted-foreground">{isSuspended ? SESSION_INFO_MESSAGES.SUSPENDED_STATUS : SESSION_INFO_MESSAGES.SCHEDULED_STATUS}</dd></div>
            {isSuspended && <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.SUSPENSION_CATEGORY_LABEL}</dt><dd className="text-muted-foreground">{session.suspension_category ?? SESSION_INFO_MESSAGES.NOT_PROVIDED}</dd></div>}
            {isSuspended && <div className="grid gap-1"><dt className="font-medium text-foreground">{SESSION_INFO_MESSAGES.SUSPENSION_REASON_LABEL}</dt><dd className="text-muted-foreground">{session.suspension_reason ?? SESSION_INFO_MESSAGES.NOT_PROVIDED}</dd></div>}
          </dl>
          <section aria-labelledby="session-attendance-title" className="grid gap-3 border-t pt-4">
            <h2 id="session-attendance-title" className="font-medium text-foreground">{SESSION_INFO_MESSAGES.ATTENDANCE_TITLE}</h2>
            {!isSuspended && <p className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.ATTENDANCE_SUMMARY(session.attendance.record_count, session.attendance.present_count)}</p>}
            {isSuspended ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{SESSION_INFO_MESSAGES.ATTENDANCE_SUSPENDED}</p> : !hasAttendanceRecords ? <p className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.ATTENDANCE_NOT_REGISTERED}</p> : session.attendance.present_count === 0 ? <p className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.ATTENDANCE_EMPTY_PRESENT}</p> : isLoading ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.PRESENT_STUDENTS_LOADING}</p> : loadError ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : students.length > 0 ? <div className="grid gap-2"><p className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.PRESENT_STUDENTS_LABEL}</p><ul className="grid gap-1 text-sm text-foreground">{students.map((student) => <li key={`${student.first_name}-${student.surname}`}>{student.first_name} {student.surname}</li>)}</ul></div> : <p className="text-sm text-muted-foreground">{SESSION_INFO_MESSAGES.ATTENDANCE_EMPTY_PRESENT}</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
