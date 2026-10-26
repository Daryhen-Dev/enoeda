"use client"

import Link from "next/link"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import { StudentRowActions } from "@/components/students/student-row-actions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { EcuadorTimeZone } from "@/lib/domain/branches/schema"
import type { ActiveStudentDiscipline } from "@/lib/domain/students/actions"
import {
  getMissingStudentData,
  hasIncompleteStudentData,
  STUDENT_ACTIVATION_STATUS,
  STUDENT_STATUS,
  type StudentListItem,
  type StudentMissingDataField,
  type StudentStatus,
} from "@/lib/domain/students"
import { getCalendarDayDifference, getCurrentDateOnly } from "@/lib/date"
import {
  STUDENT_BULK_ACTIONS_MESSAGES,
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_LIFECYCLE_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec"

/** Nearest monthly enrollment that can go overdue; per-class ones never do. */
export function getNearestDueDiscipline(
  disciplines: ActiveStudentDiscipline[]
): ActiveStudentDiscipline | undefined {
  // Per-class enrollments have no due date; only monthly ones can be overdue.
  return disciplines
    .filter((discipline) => discipline.billing_mode === "monthly")
    .reduce<ActiveStudentDiscipline | undefined>(
      (nearestDiscipline, discipline) => {
        if (discipline.next_due_date === null) return nearestDiscipline

        if (
          nearestDiscipline === undefined ||
          nearestDiscipline.next_due_date === null ||
          discipline.next_due_date < nearestDiscipline.next_due_date
        ) {
          return discipline
        }

        return nearestDiscipline
      },
      undefined,
    )
}

/** Due-date wording shared by the table cell and the mobile card. */
export function getDueDateStatus(dueDate: string, today: string): string {
  const remainingDays = getCalendarDayDifference(today, dueDate)

  if (remainingDays > 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_IN_DAYS(remainingDays)
  }

  if (remainingDays === 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_TODAY
  }

  return STUDENT_DIRECTORY_MESSAGES.OVERDUE_BY_DAYS(Math.abs(remainingDays))
}

/** Accessible name of the incomplete-data badge, listing the missing fields. */
export function getIncompleteDataDescription(
  missingFields: StudentMissingDataField[]
): string {
  const missingLabels = missingFields.map(
    (field) => STUDENT_MISSING_DATA_MESSAGES.MISSING_FIELD_LABELS[field]
  )

  return `${STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE} — ${STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_MISSING_SUMMARY(missingLabels.join(", "))}`
}

interface StudentCardProps {
  student: StudentListItem
  branchId: string
  branches: ActiveBranchOption[]
  /** Tab the card belongs to: the history tab has no due date. */
  status: StudentStatus
  canManage: boolean
  /** Bulk selection state owned by the directory; omitted cards get none. */
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  onActivated: () => void
  timeZone: EcuadorTimeZone
}

/**
 * Mobile presentation of one directory row (S2): a stacked card with the name,
 * status, disciplines and nearest monthly due date. The header is the one-tap
 * link to the detail page; everything else lives in the "Acciones" menu.
 */
export function StudentCard({
  student,
  branchId,
  branches,
  status,
  canManage,
  selected = false,
  onSelectedChange,
  onActivated,
  timeZone,
}: StudentCardProps) {
  const isActiveTab = status === STUDENT_STATUS.ACTIVE
  // Bulk deactivation only makes sense where the caller can manage the branch
  // and only over the active students the tab is showing (S4).
  const canSelect = canManage && isActiveTab && onSelectedChange !== undefined
  const today = getCurrentDateOnly(timeZone)
  const missingFields = getMissingStudentData(student)
  const incompleteDescription = getIncompleteDataDescription(missingFields)
  const nearestDiscipline = getNearestDueDiscipline(student.active_disciplines)
  const hasMonthlyEnrollment = student.active_disciplines.some(
    (discipline) => discipline.billing_mode === "monthly"
  )
  const hasPerClassEnrollment = student.active_disciplines.some(
    (discipline) => discipline.billing_mode === "per_class"
  )
  const studentName = `${student.first_name} ${student.surname}`

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        {canSelect && (
          <Checkbox
            aria-label={STUDENT_BULK_ACTIONS_MESSAGES.SELECT_ROW_LABEL(
              studentName
            )}
            checked={selected}
            onCheckedChange={(nextChecked) => onSelectedChange?.(nextChecked)}
            className="mt-0.5"
          />
        )}
        <Link
          href={`/dashboard/students/${student.id}?branch=${branchId}`}
          className="flex min-w-0 flex-1 flex-col items-start gap-1"
        >
          <span className="truncate text-sm font-medium">{studentName}</span>
          {hasIncompleteStudentData(student) && (
            <Badge
              variant="secondary"
              aria-label={incompleteDescription}
              title={incompleteDescription}
            >
              {STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE}
            </Badge>
          )}
        </Link>

        <StudentRowActions
          student={student}
          branchId={branchId}
          branches={branches}
          status={status}
          canManage={canManage}
          onActivated={onActivated}
        />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">
          {STUDENT_DIRECTORY_MESSAGES.STATUS}
        </dt>
        <dd>
          {isActiveTab
            ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS
            : STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS}
        </dd>

        {student.activation_status === STUDENT_ACTIVATION_STATUS.PENDING && (
          <>
            <dt className="text-muted-foreground">
              {STUDENT_LIFECYCLE_MESSAGES.ACTIVATION_STATUS_LABEL}
            </dt>
            <dd>{STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS}</dd>
          </>
        )}

        <dt className="text-muted-foreground">
          {STUDENT_DIRECTORY_MESSAGES.DISCIPLINES}
        </dt>
        <dd>
          {student.active_discipline_names.length > 0
            ? student.active_discipline_names.join(", ")
            : STUDENT_DIRECTORY_MESSAGES.NO_ACTIVE_DISCIPLINES}
        </dd>

        {isActiveTab && (
          <>
            <dt className="text-muted-foreground">
              {STUDENT_DIRECTORY_MESSAGES.MONTHLY_DUE_DATE}
            </dt>
            <dd className="flex flex-col gap-0.5">
              {nearestDiscipline !== undefined &&
              nearestDiscipline.next_due_date !== null ? (
                <>
                  <span className="font-medium">
                    {nearestDiscipline.discipline_name}
                  </span>
                  <span className="text-muted-foreground">
                    {getDueDateStatus(nearestDiscipline.next_due_date, today)}
                  </span>
                </>
              ) : (
                // A student enrolled only per class never has a due date.
                <span className="text-muted-foreground">
                  {!hasMonthlyEnrollment && hasPerClassEnrollment
                    ? STUDENT_DIRECTORY_MESSAGES.PER_CLASS_DUE_DATE
                    : STUDENT_DIRECTORY_MESSAGES.NO_PAYMENTS_REGISTERED}
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}
