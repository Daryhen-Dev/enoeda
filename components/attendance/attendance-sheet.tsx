"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { takeAttendance } from "@/lib/domain/attendance/actions"
import type { EligibleStudentAttendance } from "@/lib/domain/attendance/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  ATTENDANCE_FORM_MESSAGES,
  ATTENDANCE_TOAST,
  COMMON_MESSAGES,
} from "@/lib/localization/es-ec"

interface AttendanceSheetProps {
  scheduledClassId?: string
  oneTimeClassId?: string
  sessionDate: string
  students: EligibleStudentAttendance[]
  onSuccess?: () => void
}

interface AttendanceRecord {
  student_id: string
  attended: boolean
  observation: string
}

export function AttendanceSheet({
  scheduledClassId,
  oneTimeClassId,
  sessionDate,
  students,
  onSuccess,
}: AttendanceSheetProps) {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    students.map((s) => ({
      student_id: s.student_id,
      attended: s.attended ?? true,
      observation: s.observation ?? "",
    }))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRecord(index: number, field: keyof AttendanceRecord, value: unknown) {
    setRecords((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await takeAttendance({
        ...(scheduledClassId
          ? { scheduled_class_id: scheduledClassId, session_date: sessionDate }
          : { one_time_class_id: oneTimeClassId }),
        records: records.map((r) => ({
          student_id: r.student_id,
          attended: r.attended,
          observation: r.observation || null,
        })),
      })

      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      toast.success(ATTENDANCE_TOAST.SAVED)
      router.refresh()
      onSuccess?.()
    } catch {
      setError(COMMON_MESSAGES.UNEXPECTED_ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (students.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {ATTENDANCE_FORM_MESSAGES.EMPTY_ELIGIBLE}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {students.map((student, index) => (
          <div
            key={student.student_id}
            className="flex flex-col gap-1.5 rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={records[index].attended}
                  onCheckedChange={(checked) =>
                    updateRecord(index, "attended", Boolean(checked))
                  }
                  disabled={isSubmitting}
                />
                {student.first_name} {student.surname}
              </label>
            </div>
            <Input
              placeholder={ATTENDANCE_FORM_MESSAGES.OBSERVATION_PLACEHOLDER}
              value={records[index].observation}
              onChange={(e) =>
                updateRecord(index, "observation", e.target.value)
              }
              maxLength={500}
              disabled={isSubmitting}
              className="text-xs"
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? ATTENDANCE_FORM_MESSAGES.SAVING : ATTENDANCE_FORM_MESSAGES.SUBMIT}
      </Button>
    </form>
  )
}
