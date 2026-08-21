"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  assignBranchTeacher,
  enableSelfAsTeacher,
  revokeBranchTeacher,
  type StaffAssignment,
} from "@/lib/domain/roles/actions"
import { isSelfEnableEligibleRow } from "@/lib/domain/roles/self-enable-eligibility"
import {
  COMMON_MESSAGES,
  formatDate,
  TEACHER_MANAGEMENT_MESSAGES,
} from "@/lib/localization/es-ec"

import { groupStaffAssignmentsByBranchAndUser } from "./staff-list-model"

interface StaffListProps {
  assignments: StaffAssignment[]
  branchId: string
  currentUserId?: string
}

function getRoleLabel(assignment: StaffAssignment): string {
  if (assignment.role === "teacher") {
    return assignment.revoked_at === null
      ? TEACHER_MANAGEMENT_MESSAGES.TEACHER_ROLE_LABEL
      : TEACHER_MANAGEMENT_MESSAGES.DEACTIVATED_TEACHER_ROLE_LABEL
  }

  return TEACHER_MANAGEMENT_MESSAGES.SELF_ADMIN_ROLE_LABEL
}

/**
 * Admin-scoped staff list — shows all branch staff (admin + teacher).
 * The self-enable action appears as an action on the current admin's own row.
 */
export function StaffList({ assignments, branchId, currentUserId }: StaffListProps) {
  if (assignments.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{TEACHER_MANAGEMENT_MESSAGES.EMPTY_STATE}</EmptyTitle>
          <EmptyDescription>
            {TEACHER_MANAGEMENT_MESSAGES.PAGE_DESCRIPTION}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const members = groupStaffAssignmentsByBranchAndUser(assignments)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.NAME_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.EMAIL_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ROLE_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ASSIGNED_AT_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ACTIONS_LABEL}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const adminAssignment = member.assignments.find(
            (assignment) => assignment.role === "admin"
          )
          const hasActiveTeacher = member.assignments.some(
            (assignment) =>
              assignment.role === "teacher" && assignment.revoked_at === null
          )
          const hasDeactivatedTeacher = member.assignments.some(
            (assignment) =>
              assignment.role === "teacher" && assignment.revoked_at !== null
          )
          const displayedAssignments = hasActiveTeacher
            ? member.assignments.filter(
                (assignment) =>
                  assignment.role !== "teacher" || assignment.revoked_at === null
              )
            : member.assignments
          const showReactivateTeacher = !hasActiveTeacher && hasDeactivatedTeacher
          const showSelfEnable =
            !hasDeactivatedTeacher &&
            currentUserId !== undefined &&
            adminAssignment !== undefined &&
            isSelfEnableEligibleRow(
              adminAssignment,
              currentUserId,
              branchId,
              assignments
            )

          return (
            <TableRow key={`${member.branchId}-${member.userId}`}>
              <TableCell>
                {member.displayName ?? TEACHER_MANAGEMENT_MESSAGES.PROFILE_UNAVAILABLE}
              </TableCell>
              <TableCell>
                {member.email ?? TEACHER_MANAGEMENT_MESSAGES.EMAIL_UNAVAILABLE}
              </TableCell>
              <TableCell>
                <ul>
                  {displayedAssignments.map((assignment, index) => (
                    <li key={`${assignment.role}-${assignment.assigned_at}-${index}`}>
                      {getRoleLabel(assignment)}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <ul>
                  {displayedAssignments.map((assignment, index) => (
                    <li key={`${assignment.role}-${assignment.assigned_at}-${index}`}>
                      {formatDate(new Date(assignment.assigned_at))}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {hasActiveTeacher && (
                    <DeactivateTeacherDialog
                      userId={member.userId}
                      branchId={branchId}
                    />
                  )}
                  {showReactivateTeacher && (
                    <ReactivateTeacherAction
                      userId={member.userId}
                      branchId={branchId}
                    />
                  )}
                  {showSelfEnable && (
                    <SelfEnableTeacherAction branchId={branchId} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function DeactivateTeacherDialog({
  userId,
  branchId,
}: {
  userId: string
  branchId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDeactivate() {
    startTransition(async () => {
      const result = await revokeBranchTeacher({
        targetUserId: userId,
        branchId,
      })
      if (!result.success || !result.data) {
        setError(result.error ?? TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_FAILURE)
        return
      }

      if (result.data.status === "revoked") {
        setError(null)
        toast.success(
          TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_SUCCESS_TOAST(
            result.data.reassignedClassCount
          )
        )
        router.refresh()
        return
      }

      if (result.data.reason === "no_default_teacher") {
        setError(TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_NO_DEFAULT_TEACHER)
      } else if (result.data.reason === "revoked_is_default") {
        setError(TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_DEFAULT_TEACHER)
      } else if (result.data.reason === "no_active_admin") {
        setError(TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_NO_ACTIVE_ADMIN)
      } else if (result.data.reason === "conflict" && result.data.conflicts) {
        const details = result.data.conflicts
          .map((conflict) =>
            TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_CONFLICT_DETAIL(
              conflict.dayOfWeek,
              conflict.startTime
            )
          )
          .join("; ")
        setError(TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_CONFLICT(details))
      } else {
        setError(TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_FAILURE)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="xs" />}>
        {TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_CONFIRMATION_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_ERROR}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDeactivate}
          >
            {isPending
              ? TEACHER_MANAGEMENT_MESSAGES.DEACTIVATING
              : TEACHER_MANAGEMENT_MESSAGES.DEACTIVATE_ACTION}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ReactivateTeacherAction({
  userId,
  branchId,
}: {
  userId: string
  branchId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleReactivate() {
    startTransition(async () => {
      const result = await assignBranchTeacher({
        targetUserId: userId,
        branchId,
      })
      if (result.success) {
        toast.success(TEACHER_MANAGEMENT_MESSAGES.REACTIVATE_SUCCESS_TOAST)
        router.refresh()
        return
      }

      toast.error(result.error ?? TEACHER_MANAGEMENT_MESSAGES.REACTIVATE_FAILURE)
    })
  }

  return (
    <Button
      variant="outline"
      size="xs"
      disabled={isPending}
      onClick={handleReactivate}
    >
      {isPending
        ? TEACHER_MANAGEMENT_MESSAGES.REACTIVATING
        : TEACHER_MANAGEMENT_MESSAGES.REACTIVATE_ACTION}
    </Button>
  )
}

function SelfEnableTeacherAction({ branchId }: { branchId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelfEnable() {
    startTransition(async () => {
      const result = await enableSelfAsTeacher({ branchId })
      if (result.success) {
        toast.success(TEACHER_MANAGEMENT_MESSAGES.SELF_ENABLE_SUCCESS)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="xs"
      disabled={isPending}
      onClick={handleSelfEnable}
    >
      {isPending
        ? TEACHER_MANAGEMENT_MESSAGES.SELF_ENABLE_ENABLING
        : TEACHER_MANAGEMENT_MESSAGES.SELF_ENABLE_ACTION}
    </Button>
  )
}
