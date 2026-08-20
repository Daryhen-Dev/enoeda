import { notFound, redirect } from "next/navigation"
import { AlertCircleIcon, ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchSelector } from "@/components/branch/branch-selector"
import { getStudentById } from "@/lib/domain/students/actions"
import {
  getStudentDisciplines,
  getEnrollmentHistory,
} from "@/lib/domain/disciplines/actions"
import { getAttendanceStats } from "@/lib/domain/attendance/actions"
import { listProgress, listNotes } from "@/lib/domain/progress/actions"
import { getLevels } from "@/lib/domain/levels/actions"
import { getStudentPayments } from "@/lib/domain/payments/actions"
import { StudentDisciplinePanel } from "@/components/students/student-discipline-panel"
import { EnrollmentHistory } from "@/components/students/enrollment-history"
import { AttendanceStatsBadge } from "@/components/attendance/attendance-stats-badge"
import { StudentProgressPanel } from "@/components/students/student-progress-panel"
import { PromoteStudentDialog } from "@/components/students/promote-student-dialog"
import { StudentNotesPanel } from "@/components/students/student-notes-panel"
import { CreateNoteDialog } from "@/components/students/create-note-dialog"
import { StudentPaymentHistory } from "@/components/payments/student-payment-history"
import { RegisterMonthlyPaymentDialog } from "@/components/payments/register-monthly-payment-dialog"
import { RegisterClassPaymentDialog } from "@/components/payments/register-class-payment-dialog"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { Button } from "@/components/ui/button"
import {
  ATTENDANCE_FORM_MESSAGES,
  PAYMENT_MESSAGES,
  STUDENT_DIRECTORY_MESSAGES,
} from "@/lib/localization/es-ec"

interface StudentDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: StudentDetailPageProps) {
  const { id } = await params
  const search = await searchParams

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(search.branch)

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{STUDENT_DIRECTORY_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {STUDENT_DIRECTORY_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/students/${id}?${redirectParams.toString()}`)
  }

  if (branchResult.type === "selector") {
    const otherParams = Object.fromEntries(
      Object.entries(search).filter(([key]) => key !== "branch")
    ) as Record<string, string>

    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath={`/dashboard/students/${id}`}
        currentParams={otherParams}
      />
    )
  }

  // Valid branch — proceed with scoped data
  const canManage = branchResult.canManage

  const [studentResult, disciplinesResult, historyResult] = await Promise.all([
    getStudentById(id, branchResult.branchId),
    getStudentDisciplines({ student_id: id, branch_id: branchResult.branchId }),
    getEnrollmentHistory({ student_id: id, branch_id: branchResult.branchId }),
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

  // Fetch per-discipline attendance stats for active enrollments
  const activeEnrollments = enrollments.filter((e) => e.is_active)
  const statsResults = await Promise.all(
    activeEnrollments.map((enrollment) =>
      getAttendanceStats({ student_id: id, discipline_id: enrollment.discipline_id, branch_id: branchResult.branchId })
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

  // Fetch progress and notes data
  const [progressResult, notesResult, paymentsResult] = await Promise.all([
    listProgress({ student_id: id, branch_id: branchResult.branchId }),
    listNotes({ student_id: id, branch_id: branchResult.branchId }),
    getStudentPayments({ student_id: id, branch_id: branchResult.branchId }),
  ])

  const progressData =
    progressResult.success && progressResult.data ? progressResult.data : []
  const notesData =
    notesResult.success && notesResult.data ? notesResult.data : []
  const paymentsData =
    paymentsResult.success && paymentsResult.data
      ? paymentsResult.data
      : { monthly: [], perClass: [] }

  // Fetch levels for each active discipline (needed for promotion dialog)
  const levelsResults = await Promise.all(
    activeEnrollments.map((enrollment) =>
      getLevels({ discipline_id: enrollment.discipline_id })
    )
  )

  const activeDisciplineLevels = activeEnrollments.map((enrollment, index) => {
    const result = levelsResults[index]
    return {
      disciplineId: enrollment.discipline_id,
      disciplineName: enrollment.discipline_name,
      levels: result.success && result.data ? result.data : [],
    }
  })

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link href={`/dashboard/students?branch=${branchResult.branchId}`} aria-label="Back to students" />
          }
        >
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {student.first_name} {student.surname}
          </h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
          {student.phone && (
            <p className="text-sm text-muted-foreground">{student.phone}</p>
          )}
        </div>
      </div>

      <StudentDisciplinePanel
        enrollments={enrollments}
        canManage={canManage}
        branchId={branchResult.branchId}
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

      {/* Progress panel + promotion dialogs */}
      {progressData.length > 0 || canManage ? (
        <div className="flex flex-col gap-3">
          <StudentProgressPanel progress={progressData} canPromote={canManage} />
          {canManage && activeDisciplineLevels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeDisciplineLevels.map(({ disciplineId, disciplineName, levels: dLevels }) => (
                dLevels.length > 0 && (
                  <PromoteStudentDialog
                    key={disciplineId}
                    studentId={id}
                    disciplineId={disciplineId}
                    disciplineName={disciplineName}
                    levels={dLevels}
                    branchId={branchResult.branchId}
                  />
                )
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Notes panel */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <StudentNotesPanel notes={notesData} branchId={branchResult.branchId} />
        </div>
        {canManage && (
          <CreateNoteDialog
            studentId={id}
            disciplines={activeEnrollments.map((e) => ({
              id: e.discipline_id,
              name: e.discipline_name,
            }))}
            branchId={branchResult.branchId}
          />
        )}
      </div>

      {/* Payments panel */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {PAYMENT_MESSAGES.HISTORY_TITLE}
        </h2>
        <StudentPaymentHistory
          monthly={paymentsData.monthly}
          perClass={paymentsData.perClass}
        />
        {canManage && activeEnrollments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeEnrollments.map((enrollment) => (
              <RegisterMonthlyPaymentDialog
                key={`monthly-${enrollment.id}`}
                studentDisciplineId={enrollment.id}
                branchId={branchResult.branchId}
              />
            ))}
            {activeEnrollments.map((enrollment) => (
              <RegisterClassPaymentDialog
                key={`class-${enrollment.id}`}
                studentDisciplineId={enrollment.id}
                branchId={branchResult.branchId}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
