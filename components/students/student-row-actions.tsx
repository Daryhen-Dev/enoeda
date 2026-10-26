"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { MoreHorizontalIcon } from "lucide-react"

import { RegisterClassPaymentDialog } from "@/components/payments/register-class-payment-dialog"
import { RegisterMonthlyPaymentDialog } from "@/components/payments/register-monthly-payment-dialog"
import { StudentActivateDialog } from "@/components/students/student-activate-dialog"
import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import {
  StudentFormDialog,
  type ActiveBranchOption,
} from "@/components/students/student-form-dialog"
import { StudentReactivateDialog } from "@/components/students/student-reactivate-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  STUDENT_ACTIVATION_STATUS,
  STUDENT_STATUS,
  type StudentListItem,
  type StudentStatus,
} from "@/lib/domain/students"
import { STUDENT_ROW_ACTIONS_MESSAGES } from "@/lib/localization/es-ec"

/**
 * The single action a row asked for. Only one dialog is mounted at a time and
 * always outside the menu popup, so the menu never nests a dialog.
 */
type RowAction =
  | { kind: "edit" }
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "reactivate" }
  | { kind: "monthly-payment"; studentDisciplineId: string }
  | { kind: "class-payment"; studentDisciplineId: string }

interface StudentRowActionsProps {
  student: StudentListItem
  branchId: string
  branches: ActiveBranchOption[]
  /** Tab the row belongs to: the active tab owns the administrative actions. */
  status: StudentStatus
  canManage: boolean
  onActivated: () => void
}

/**
 * "Acciones" menu of one directory row (S2). It carries every action the wide
 * table used to lay out side by side, so the row never needs horizontal
 * scrolling; selecting an item opens its dialog from state.
 */
export function StudentRowActions({
  student,
  branchId,
  branches,
  status,
  canManage,
  onActivated,
}: StudentRowActionsProps) {
  const [action, setAction] = useState<RowAction | null>(null)
  const isActiveTab = status === STUDENT_STATUS.ACTIVE
  const studentName = `${student.first_name} ${student.surname}`
  const detailHref = `/dashboard/students/${student.id}?branch=${branchId}`

  function closeAction() {
    setAction(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={STUDENT_ROW_ACTIONS_MESSAGES.TRIGGER_ARIA(
                studentName
              )}
            />
          }
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href={detailHref} />}>
              {STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL}
            </DropdownMenuItem>

            {isActiveTab &&
              student.active_disciplines.map((discipline) => (
                <Fragment key={discipline.id}>
                  {canManage && discipline.billing_mode === "monthly" && (
                    <DropdownMenuItem
                      onClick={() =>
                        setAction({
                          kind: "monthly-payment",
                          studentDisciplineId: discipline.id,
                        })
                      }
                    >
                      {STUDENT_ROW_ACTIONS_MESSAGES.MONTHLY_PAYMENT(
                        discipline.discipline_name
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() =>
                      setAction({
                        kind: "class-payment",
                        studentDisciplineId: discipline.id,
                      })
                    }
                  >
                    {STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT(
                      discipline.discipline_name
                    )}
                  </DropdownMenuItem>
                </Fragment>
              ))}

            {isActiveTab && (
              <DropdownMenuItem onClick={() => setAction({ kind: "edit" })}>
                {STUDENT_ROW_ACTIONS_MESSAGES.EDIT}
              </DropdownMenuItem>
            )}

            {canManage &&
              isActiveTab &&
              student.activation_status === STUDENT_ACTIVATION_STATUS.PENDING && (
                <DropdownMenuItem
                  onClick={() => setAction({ kind: "activate" })}
                >
                  {STUDENT_ROW_ACTIONS_MESSAGES.ACTIVATE}
                </DropdownMenuItem>
              )}

            {canManage && isActiveTab && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setAction({ kind: "deactivate" })}
              >
                {STUDENT_ROW_ACTIONS_MESSAGES.DEACTIVATE}
              </DropdownMenuItem>
            )}

            {!isActiveTab && (
              <DropdownMenuItem
                onClick={() => setAction({ kind: "reactivate" })}
              >
                {STUDENT_ROW_ACTIONS_MESSAGES.REACTIVATE}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {action?.kind === "edit" && (
        <StudentFormDialog
          branches={branches}
          studentId={student.id}
          branchId={branchId}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
        />
      )}

      {action?.kind === "activate" && (
        <StudentActivateDialog
          student={{
            id: student.id,
            first_name: student.first_name,
            surname: student.surname,
          }}
          branchId={branchId}
          onActivated={onActivated}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
          hideTrigger
        />
      )}

      {action?.kind === "deactivate" && (
        <StudentDeactivateDialog
          student={{
            id: student.id,
            first_name: student.first_name,
            surname: student.surname,
          }}
          branchId={branchId}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
          hideTrigger
        />
      )}

      {action?.kind === "reactivate" && (
        <StudentReactivateDialog
          student={{ id: student.id, branch_id: student.branch_id }}
          branches={branches}
          callerBranchId={branchId}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
          hideTrigger
        />
      )}

      {action?.kind === "monthly-payment" && (
        <RegisterMonthlyPaymentDialog
          studentDisciplineId={action.studentDisciplineId}
          branchId={branchId}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
          hideTrigger
        />
      )}

      {action?.kind === "class-payment" && (
        <RegisterClassPaymentDialog
          studentDisciplineId={action.studentDisciplineId}
          branchId={branchId}
          open
          onOpenChange={(open) => {
            if (!open) closeAction()
          }}
          hideTrigger
        />
      )}
    </>
  )
}
