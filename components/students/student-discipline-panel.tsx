"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  suspendEnrollment,
  reactivateEnrollment,
} from "@/lib/domain/disciplines/actions"
import type { StudentDisciplineRecord } from "@/lib/domain/disciplines/actions"
import {
  ENROLLMENT_MESSAGES,
  TOAST_MESSAGES,
  COMMON_MESSAGES,
  formatDate,
} from "@/lib/localization/es-ec"

interface StudentDisciplinePanelProps {
  enrollments: StudentDisciplineRecord[]
  canManage: boolean
  branchId: string
}

export function StudentDisciplinePanel({
  enrollments,
  canManage,
  branchId,
}: StudentDisciplinePanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSuspend(studentDisciplineId: string) {
    startTransition(async () => {
      const result = await suspendEnrollment({
        student_discipline_id: studentDisciplineId,
        branch_id: branchId,
      })
      if (result.success) {
        toast.success(TOAST_MESSAGES.ENROLLMENT_SUSPENDED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleReactivate(studentDisciplineId: string) {
    startTransition(async () => {
      const result = await reactivateEnrollment({
        student_discipline_id: studentDisciplineId,
        branch_id: branchId,
      })
      if (result.success) {
        toast.success(TOAST_MESSAGES.ENROLLMENT_REACTIVATED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  if (enrollments.length === 0) {
    return (
      <section aria-label={ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}>
        <h2 className="mb-2 text-lg font-semibold">
          {ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}
        </h2>
        <p className="text-sm text-muted-foreground">
          {ENROLLMENT_MESSAGES.NO_DISCIPLINES}
        </p>
      </section>
    )
  }

  return (
    <section aria-label={ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}>
      <h2 className="mb-3 text-lg font-semibold">
        {ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}
      </h2>
      <div className="flex flex-col gap-3">
        {enrollments.map((enrollment) => (
          <div
            key={enrollment.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{enrollment.discipline_name}</span>
              <Badge variant={enrollment.is_active ? "default" : "secondary"}>
                {enrollment.is_active
                  ? ENROLLMENT_MESSAGES.ACTIVE_LABEL
                  : ENROLLMENT_MESSAGES.SUSPENDED_LABEL}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {ENROLLMENT_MESSAGES.ENROLLED_LABEL}{" "}
                {formatDate(new Date(enrollment.enrolled_at))}
              </span>
              {canManage && (
                <>
                  {enrollment.is_active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleSuspend(enrollment.id)}
                    >
                      {ENROLLMENT_MESSAGES.SUSPEND_ACTION}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleReactivate(enrollment.id)}
                    >
                      {ENROLLMENT_MESSAGES.REACTIVATE_ACTION}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
