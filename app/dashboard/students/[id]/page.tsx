import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

import { getStudentById } from "@/lib/domain/students/actions"
import {
  getStudentDisciplines,
  getEnrollmentHistory,
} from "@/lib/domain/disciplines/actions"
import { StudentDisciplinePanel } from "@/components/students/student-discipline-panel"
import { EnrollmentHistory } from "@/components/students/enrollment-history"
import { getAuthenticatedContext } from "@/lib/auth/server-context"
import { Button } from "@/components/ui/button"

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

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/dashboard/students" aria-label="Back to students">
            <ArrowLeftIcon />
          </Link>
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

      <EnrollmentHistory events={history} />
    </main>
  )
}
