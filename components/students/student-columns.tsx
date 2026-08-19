"use client"

import type { ColumnDef, TableFeatures } from "@tanstack/react-table"
import Link from "next/link"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import { StudentFormDialog } from "@/components/students/student-form-dialog"
import { StudentReactivateDialog } from "@/components/students/student-reactivate-dialog"
import { Button } from "@/components/ui/button"
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
}

export function getStudentColumns({
  branchId,
  branches,
  status,
}: StudentColumnsOptions): ColumnDef<TableFeatures, StudentListItem>[] {
  const isActive = status === STUDENT_STATUS.ACTIVE

  return [
    {
      id: "actions",
      header: STUDENT_DIRECTORY_MESSAGES.ACTIONS,
      cell: ({ row }) => {
        const student = row.original

        return (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/students/${student.id}?branch=${branchId}`} />}
            >
              {STUDENT_DIRECTORY_MESSAGES.VIEW_DETAILS}
            </Button>
            {isActive ? (
              <>
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
              </>
            ) : (
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
