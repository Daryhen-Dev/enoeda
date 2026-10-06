import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StudentProfile } from "@/lib/domain/students/actions"
import { getAgeInYears } from "@/lib/domain/students/detail-summary"
import {
  formatNumber,
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_DETAIL_MESSAGES,
} from "@/lib/localization/es-ec"

interface StudentDetailHeaderProps {
  student: StudentProfile
  backHref: string
  /** Current date as "YYYY-MM-DD" in the branch timezone (getCurrentDateOnly). */
  todayDateOnly: string
}

/**
 * Page header for the student detail (resumen) page: back navigation,
 * full name with active/inactive badge, and one muted meta line with
 * age, national id, email and phone (missing values are skipped).
 */
export function StudentDetailHeader({
  student,
  backHref,
  todayDateOnly,
}: StudentDetailHeaderProps) {
  const age = getAgeInYears(student.date_of_birth, todayDateOnly)
  const metaItems = [
    STUDENT_DETAIL_MESSAGES.AGE_LABEL(formatNumber(age)),
    student.national_id
      ? `${STUDENT_DIRECTORY_MESSAGES.NATIONAL_ID}: ${student.national_id}`
      : null,
    student.email || null,
    student.phone || null,
  ].filter((item): item is string => item !== null)

  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link href={backHref} aria-label="Back to students" />
          }
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {student.first_name} {student.surname}
        </h1>
        <Badge variant={student.is_active ? "default" : "secondary"}>
          {student.is_active
            ? STUDENT_DETAIL_MESSAGES.ACTIVE_BADGE
            : STUDENT_DETAIL_MESSAGES.INACTIVE_BADGE}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{metaItems.join(" · ")}</p>
    </header>
  )
}
