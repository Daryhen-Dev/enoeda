"use client"

import { StudentDisciplineCard } from "@/components/students/student-discipline-card"
import type { DisciplineAttendanceStats } from "@/components/students/student-discipline-card"
import type { StudentDisciplineRecord } from "@/lib/domain/disciplines/actions"
import type { LevelRecord } from "@/lib/domain/levels/actions"
import type { PaymentRecord } from "@/lib/domain/payments/actions"
import type { StudentProgressSummary } from "@/lib/domain/progress/actions"
import { getLatestPaidThrough, orderEnrollmentsActiveFirst } from "@/lib/domain/students/detail-summary"
import { ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec"

interface StudentDisciplinePanelProps {
  enrollments: StudentDisciplineRecord[]
  summaries: StudentProgressSummary[]
  attendanceStats: (DisciplineAttendanceStats & { discipline_id: string })[]
  monthlyPayments: PaymentRecord[]
  levelsByDisciplineId: Record<string, LevelRecord[]>
  canManage: boolean
  studentId: string
  branchId: string
}

/**
 * "Disciplinas" section: one card per enrollment, active first, grouping
 * everything about each discipline (status, level progression, attendance,
 * monthly-payment coverage and management actions).
 */
export function StudentDisciplinePanel({
  enrollments,
  summaries,
  attendanceStats,
  monthlyPayments,
  levelsByDisciplineId,
  canManage,
  studentId,
  branchId,
}: StudentDisciplinePanelProps) {
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

  const orderedEnrollments = orderEnrollmentsActiveFirst(enrollments)

  return (
    <section aria-label={ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}>
      <h2 className="mb-3 text-lg font-semibold">
        {ENROLLMENT_MESSAGES.DISCIPLINES_LABEL}
      </h2>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {orderedEnrollments.map((enrollment) => {
          const summary =
            summaries.find(
              (item) => item.discipline_id === enrollment.discipline_id
            ) ?? null
          const attendance =
            attendanceStats.find(
              (item) => item.discipline_id === enrollment.discipline_id
            ) ?? null
          const paidThrough = getLatestPaidThrough(
            monthlyPayments,
            enrollment.discipline_name
          )

          return (
            <StudentDisciplineCard
              key={enrollment.id}
              enrollment={enrollment}
              summary={summary}
              attendance={attendance}
              paidThrough={paidThrough}
              levels={levelsByDisciplineId[enrollment.discipline_id] ?? []}
              canManage={canManage}
              studentId={studentId}
              branchId={branchId}
            />
          )
        })}
      </div>
    </section>
  )
}
