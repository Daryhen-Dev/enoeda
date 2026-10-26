"use client"

import type { ColumnDef, TableFeatures } from "@tanstack/react-table"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import {
  getDueDateStatus,
  getIncompleteDataDescription,
  getNearestDueDiscipline,
} from "@/components/students/student-card"
import { StudentRowActions } from "@/components/students/student-row-actions"
import { Badge } from "@/components/ui/badge"
import type { EcuadorTimeZone } from "@/lib/domain/branches/schema"
import { getCurrentDateOnly } from "@/lib/date"
import {
  getMissingStudentData,
  hasIncompleteStudentData,
  STUDENT_ACTIVATION_STATUS,
  STUDENT_STATUS,
  type StudentListItem,
  type StudentStatus,
} from "@/lib/domain/students"
import {
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_LIFECYCLE_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec"

interface StudentColumnsOptions {
  branchId: string
  branches: ActiveBranchOption[]
  status: StudentStatus
  canManage: boolean
  onActivated: () => void
  timeZone: EcuadorTimeZone
}

function StudentNameCell({ student }: { student: StudentListItem }) {
  const missingFields = getMissingStudentData(student)

  return (
    <div className="flex min-w-32 flex-col items-start gap-1">
      <span>{student.first_name}</span>
      {hasIncompleteStudentData(student) && (
        <Badge
          variant="secondary"
          aria-label={getIncompleteDataDescription(missingFields)}
          title={getIncompleteDataDescription(missingFields)}
        >
          {STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE}
        </Badge>
      )}
    </div>
  )
}

export function getStudentColumns({
  branchId,
  branches,
  status,
  canManage,
  onActivated,
  timeZone,
}: StudentColumnsOptions): ColumnDef<TableFeatures, StudentListItem>[] {
  const isActive = status === STUDENT_STATUS.ACTIVE
  const today = getCurrentDateOnly(timeZone)

  return [
    {
      id: "actions",
      header: STUDENT_DIRECTORY_MESSAGES.ACTIONS,
      cell: ({ row }) => (
        // One menu per row keeps every action reachable without widening the row.
        <StudentRowActions
          student={row.original}
          branchId={branchId}
          branches={branches}
          status={status}
          canManage={canManage}
          onActivated={onActivated}
        />
      ),
    },
    {
      accessorKey: "first_name",
      header: STUDENT_DIRECTORY_MESSAGES.FIRST_NAME,
      cell: ({ row }) => <StudentNameCell student={row.original} />,
    },
    {
      accessorKey: "surname",
      header: STUDENT_DIRECTORY_MESSAGES.SURNAME,
    },
    {
      accessorKey: "national_id",
      header: STUDENT_DIRECTORY_MESSAGES.NATIONAL_ID,
      cell: ({ row }) =>
        row.original.national_id ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED,
    },
    {
      accessorKey: "active_discipline_names",
      header: STUDENT_DIRECTORY_MESSAGES.DISCIPLINES,
      cell: ({ row }) => {
        const disciplineNames = row.original.active_discipline_names

        return disciplineNames.length > 0
          ? disciplineNames.join(", ")
          : STUDENT_DIRECTORY_MESSAGES.NO_ACTIVE_DISCIPLINES
      },
    },
    ...(isActive
      ? [
          {
            id: "monthly-due-date",
            header: STUDENT_DIRECTORY_MESSAGES.MONTHLY_DUE_DATE,
            cell: ({ row }: { row: { original: StudentListItem } }) => {
              const disciplines = row.original.active_disciplines
              const nearestDiscipline = getNearestDueDiscipline(disciplines)

              if (
                nearestDiscipline === undefined ||
                nearestDiscipline.next_due_date === null
              ) {
                // A student enrolled only per class never has a due date.
                if (
                  !disciplines.some(
                    (discipline) => discipline.billing_mode === "monthly",
                  ) &&
                  disciplines.some(
                    (discipline) => discipline.billing_mode === "per_class",
                  )
                ) {
                  return STUDENT_DIRECTORY_MESSAGES.PER_CLASS_DUE_DATE
                }

                return STUDENT_DIRECTORY_MESSAGES.NO_PAYMENTS_REGISTERED
              }

              return (
                <div className="flex min-w-40 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {nearestDiscipline.discipline_name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getDueDateStatus(nearestDiscipline.next_due_date, today)}
                  </span>
                </div>
              )
            },
          },
        ]
      : []),
    {
      accessorKey: "activation_status",
      header: STUDENT_LIFECYCLE_MESSAGES.ACTIVATION_STATUS_LABEL,
      cell: ({ row }) =>
        row.original.activation_status === STUDENT_ACTIVATION_STATUS.PENDING
          ? STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS
          : STUDENT_LIFECYCLE_MESSAGES.ACTIVE_ACTIVATION_STATUS,
    },
    {
      id: "status",
      header: STUDENT_DIRECTORY_MESSAGES.STATUS,
      cell: () =>
        isActive
          ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS
          : STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS,
    },
  ]
}
