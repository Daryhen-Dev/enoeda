import { notFound, redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getStudentById } from "@/lib/domain/students/actions"
import {
  getStudentDisciplines,
  getEnrollmentHistory,
} from "@/lib/domain/disciplines/actions"
import { getAttendanceStats } from "@/lib/domain/attendance/actions"
import {
  getStudentProgressSummary,
  listProgress,
  listNotes,
} from "@/lib/domain/progress/actions"
import { getLevels } from "@/lib/domain/levels/actions"
import { getStudentPayments } from "@/lib/domain/payments/actions"
import { getBranchPaymentSettings } from "@/lib/domain/branches/actions"
import { StudentDisciplinePanel } from "@/components/students/student-discipline-panel"
import { StudentDetailHeader } from "@/components/students/student-detail-header"
import { StudentHistoryTabs } from "@/components/students/student-history-tabs"
import { StudentProgressPanel } from "@/components/students/student-progress-panel"
import { StudentNotesPanel } from "@/components/students/student-notes-panel"
import { CreateNoteDialog } from "@/components/students/create-note-dialog"
import { StudentPaymentHistory } from "@/components/payments/student-payment-history"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { getCurrentDateOnly } from "@/lib/date"
import {
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

  // Valid branch — proceed with scoped data
  const canManage = branchResult.canManage
  const paymentSettingsResult = canManage
    ? await getBranchPaymentSettings(branchResult.branchId)
    : null
  const paymentSettings = paymentSettingsResult?.success
    ? paymentSettingsResult.data
    : undefined
  const paymentSettingsAvailable = paymentSettings !== undefined
  const paymentEditWindowDays = paymentSettings?.payment_edit_window_days ?? null

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
      ...(result.success && result.data
        ? result.data
        : { present: 0, total: 0, percentage: 0 }),
    }
  })

  // Fetch progress, progression summary, notes, and payments data
  const [progressResult, progressSummaryResult, notesResult, paymentsResult] =
    await Promise.all([
      listProgress({ student_id: id, branch_id: branchResult.branchId }),
      getStudentProgressSummary({
        student_id: id,
        branch_id: branchResult.branchId,
      }),
      listNotes({ student_id: id, branch_id: branchResult.branchId }),
      getStudentPayments({ student_id: id, branch_id: branchResult.branchId }),
    ])

  const progressData =
    progressResult.success && progressResult.data ? progressResult.data : []
  const progressSummaryData =
    progressSummaryResult.success && progressSummaryResult.data
      ? progressSummaryResult.data
      : []
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
      levels: result.success && result.data ? result.data : [],
    }
  })
  const levelsByDisciplineId = Object.fromEntries(
    activeDisciplineLevels.map((item) => [item.disciplineId, item.levels])
  )

  const historyDefaultTab = canManage ? "payments" : "notes"
  const todayDateOnly = getCurrentDateOnly(branchResult.timeZone)

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <StudentDetailHeader
        student={student}
        backHref={`/dashboard/students?branch=${branchResult.branchId}`}
        todayDateOnly={todayDateOnly}
      />

      <StudentDisciplinePanel
        enrollments={enrollments}
        summaries={progressSummaryData}
        attendanceStats={attendanceStats}
        monthlyPayments={paymentsData.monthly}
        levelsByDisciplineId={levelsByDisciplineId}
        canManage={canManage}
        studentId={id}
        branchId={branchResult.branchId}
      />

      <StudentHistoryTabs
        defaultTab={historyDefaultTab}
        noteCount={notesData.length}
        paymentCount={paymentsData.monthly.length + paymentsData.perClass.length}
        progressCount={progressData.length}
        enrollmentEventCount={history.length}
        notesSlot={
          <div className="flex flex-col gap-3">
            <StudentNotesPanel
              notes={notesData}
              branchId={branchResult.branchId}
              visibleCount={10}
            />
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
        }
        paymentsSlot={
          <StudentPaymentHistory
            monthly={paymentsData.monthly}
            perClass={paymentsData.perClass}
            branchId={branchResult.branchId}
            canManage={canManage}
            paymentSettingsAvailable={paymentSettingsAvailable}
            paymentEditWindowDays={paymentEditWindowDays}
            visibleCount={10}
          />
        }
        progressSlot={
          <StudentProgressPanel progress={progressData} visibleCount={10} />
        }
        enrollmentEvents={history}
      />
    </main>
  )
}
