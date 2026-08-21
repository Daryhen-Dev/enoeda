"use client"

import type { ColumnDef, TableFeatures } from "@tanstack/react-table"
import Link from "next/link"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import { RegisterClassPaymentDialog } from "@/components/payments/register-class-payment-dialog"
import { RegisterMonthlyPaymentDialog } from "@/components/payments/register-monthly-payment-dialog"
import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import { StudentFormDialog } from "@/components/students/student-form-dialog"
import { StudentReactivateDialog } from "@/components/students/student-reactivate-dialog"
import { Button } from "@/components/ui/button"
import type { EcuadorTimeZone } from "@/lib/domain/branches/schema"
import { getCalendarDayDifference, getCurrentDateOnly } from "@/lib/date"
import type { ActiveStudentDiscipline } from "@/lib/domain/students/actions"
import {
  STUDENT_STATUS,
  type StudentListItem,
  type StudentStatus,
} from "@/lib/domain/students"
import { STUDENT_DIRECTORY_MESSAGES } from "@/lib/localization/es-ec"

interface StudentColumnsOptions {
  branchId: string
  branches: ActiveBranchOption[]
  status: StudentStatus
  canManage: boolean
  timeZone: EcuadorTimeZone
}

function getNearestDueDiscipline(
  disciplines: ActiveStudentDiscipline[]
): ActiveStudentDiscipline | undefined {
  return disciplines.reduce<ActiveStudentDiscipline | undefined>(
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

function getDueDateStatus(dueDate: string, today: string): string {
  const remainingDays = getCalendarDayDifference(today, dueDate)

  if (remainingDays > 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_IN_DAYS(remainingDays)
  }

  if (remainingDays === 0) {
    return STUDENT_DIRECTORY_MESSAGES.DUE_TODAY
  }

  return STUDENT_DIRECTORY_MESSAGES.OVERDUE_BY_DAYS(Math.abs(remainingDays))
}

export function getStudentColumns({
  branchId,
  branches,
  status,
  canManage,
  timeZone,
}: StudentColumnsOptions): ColumnDef<TableFeatures, StudentListItem>[] {
  const isActive = status === STUDENT_STATUS.ACTIVE
  const today = getCurrentDateOnly(timeZone)

  return [
    {
      id: "actions",
      header: STUDENT_DIRECTORY_MESSAGES.ACTIONS,
      cell: ({ row }) => {
        const student = row.original

        return (
          <div className="flex min-w-56 flex-wrap items-start gap-3">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/students/${student.id}?branch=${branchId}`} />}
            >
              {STUDENT_DIRECTORY_MESSAGES.VIEW_DETAILS}
            </Button>

            {isActive && (
              <>
                <section
                  aria-label={STUDENT_DIRECTORY_MESSAGES.PAYMENT_ENROLLMENTS_LABEL}
                  className="flex flex-wrap items-center gap-2"
                >
                  {student.active_disciplines.length > 0 ? (
                    student.active_disciplines.map((discipline) => (
                      <div
                        key={discipline.id}
                        role="group"
                        aria-label={STUDENT_DIRECTORY_MESSAGES.PAYMENT_ACTIONS_BY_DISCIPLINE(
                          discipline.discipline_name,
                        )}
                        className="flex flex-wrap gap-2"
                      >
                        {canManage && (
                          <RegisterMonthlyPaymentDialog
                            studentDisciplineId={discipline.id}
                            branchId={branchId}
                          />
                        )}
                        <RegisterClassPaymentDialog
                          studentDisciplineId={discipline.id}
                          branchId={branchId}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {STUDENT_DIRECTORY_MESSAGES.NO_PAYMENT_ENROLLMENTS}
                    </p>
                  )}
                </section>

                <div
                  aria-label={STUDENT_DIRECTORY_MESSAGES.ADMINISTRATIVE_ACTIONS_LABEL}
                  className="flex flex-wrap gap-2"
                >
                  <StudentFormDialog
                    branches={branches}
                    studentId={student.id}
                    branchId={branchId}
                  />
                  <StudentDeactivateDialog
                    student={{
                      id: student.id,
                      first_name: student.first_name,
                      surname: student.surname,
                    }}
                    branchId={branchId}
                  />
                </div>
              </>
            )}

            {!isActive && (
              <StudentReactivateDialog
                student={{ id: student.id, branch_id: student.branch_id }}
                branches={branches}
                callerBranchId={branchId}
              />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "first_name",
      header: STUDENT_DIRECTORY_MESSAGES.FIRST_NAME,
    },
    {
      accessorKey: "surname",
      header: STUDENT_DIRECTORY_MESSAGES.SURNAME,
    },
    {
      accessorKey: "national_id",
      header: STUDENT_DIRECTORY_MESSAGES.NATIONAL_ID,
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
              const nearestDiscipline = getNearestDueDiscipline(
                row.original.active_disciplines,
              )

              if (
                nearestDiscipline === undefined ||
                nearestDiscipline.next_due_date === null
              ) {
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
      id: "status",
      header: STUDENT_DIRECTORY_MESSAGES.STATUS,
      cell: () =>
        isActive
          ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS
          : STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS,
    },
  ]
}
