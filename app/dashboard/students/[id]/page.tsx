import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

import { getStudentById } from "@/lib/domain/students/actions"
import {
  getStudentDisciplines,
  getEnrollmentHistory,
} from "@/lib/domain/disciplines/actions"
import { getAttendanceStats } from "@/lib/domain/attendance/actions"
import { StudentDisciplinePanel } from "@/components/students/student-discipline-panel"
import { EnrollmentHistory } from "@/components/students/enrollment-history"
import { AttendanceStatsBadge } from "@/components/attendance/attendance-stats-badge"
import { getAuthenticatedContext } from "@/lib/auth/server-context"
import { Button } from "@/components/ui/button"
import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec"

interface StudentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const { id } = await params

  const [studentResult, disciplinesResult, historyResult, authResult] =
    await Promise.all([
      getStudentById(id),
      getStudentDisciplines({ student_id: id }),
      getEnrollmentHistory({ student_id: id }),
      getAuthenticatedContext(),
    ])

  if (!studentResult.success || !studentResult.data) {
    notFound()
  }

  const student = studentResult.data
  const enrollments =
    disciplinesResult.success && disciplinesResult.data
      ? disciplinesResult.data
      : []
  const history =
    historyResult.success && historyResult.data ? historyResult.data : []

  // admin/owner can manage enrollments
  const canManage =
    authResult.ok &&
    authResult.ctx.roles.some((r) => r === "owner" || r === "admin")

  // Fetch per-discipline attendance stats for active enrollments
  const activeEnrollments = enrollments.filter((e) => e.is_active)
  const statsResults = await Promise.all(
    activeEnrollments.map((enrollment) =>
      getAttendanceStats({ student_id: id, discipline_id: enrollment.discipline_id })
    )
  )

  const attendanceStats = activeEnrollments.map((enrollment, index) => {
    const result = statsResults[index]
    return {
      discipline_id: enrollment.discipline_id,
      stats:
        result.success && result.data
          ? result.data
          : { present: 0, total: 0, percentage: 0 },
    }
  })

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={
            <Link href="/dashboard/students" aria-label="Back to students" />
          }
        >
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {student.first_name} {student.surname}
          </h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
      </div>

      <StudentDisciplinePanel
        enrollments={enrollments}
        canManage={canManage}
      />

      {attendanceStats.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {ATTENDANCE_FORM_MESSAGES.STATS_LABEL}
          </h2>
          <div className="flex flex-wrap gap-2">
            {attendanceStats.map((item) => {
              const enrollment = activeEnrollments.find(
                (e) => e.discipline_id === item.discipline_id
              )
              return (
                <div key={item.discipline_id} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {enrollment?.discipline_name ?? item.discipline_id}:
                  </span>
                  <AttendanceStatsBadge
                    present={item.stats.present}
                    total={item.stats.total}
                    percentage={item.stats.percentage}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      <EnrollmentHistory events={history} />
    </main>
  )
}
