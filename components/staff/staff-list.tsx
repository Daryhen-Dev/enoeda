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
import { revokeBranchRole } from "@/lib/domain/roles/actions"
import { enableSelfAsTeacher } from "@/lib/domain/roles/actions"
import type { StaffAssignment } from "@/lib/domain/roles/actions"
import { isSelfEnableEligibleRow } from "@/lib/domain/roles/self-enable-eligibility"
import {
  COMMON_MESSAGES,
  formatDate,
  TEACHER_MANAGEMENT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface StaffListProps {
  assignments: StaffAssignment[]
  branchId: string
  currentUserId?: string
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.NAME_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ROLE_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ASSIGNED_AT_LABEL}</TableHead>
          <TableHead>{TEACHER_MANAGEMENT_MESSAGES.ACTIONS_LABEL}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.map((assignment) => {
          const showSelfEnable =
            currentUserId !== undefined &&
            isSelfEnableEligibleRow(
              assignment,
              currentUserId,
              branchId,
              assignments
            )

          return (
            <TableRow key={`${assignment.user_id}-${assignment.role}`}>
              <TableCell>
                {assignment.display_name ?? TEACHER_MANAGEMENT_MESSAGES.PROFILE_UNAVAILABLE}
              </TableCell>
              <TableCell className="capitalize">
                {assignment.role}
              </TableCell>
              <TableCell>
                {formatDate(new Date(assignment.assigned_at))}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {assignment.role === "teacher" && (
                    <RevokeTeacherDialog
                      userId={assignment.user_id}
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

function RevokeTeacherDialog({
  userId,
  branchId,
}: {
  userId: string
  branchId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeBranchRole({
        targetUserId: userId,
        role: "teacher",
        branchId,
      })
      if (result.success) {
        setError(null)
        toast.success(TOAST_MESSAGES.TEACHER_REVOKED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="xs" />}>
        {TEACHER_MANAGEMENT_MESSAGES.REVOKE_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {TEACHER_MANAGEMENT_MESSAGES.REVOKE_CONFIRMATION_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {TEACHER_MANAGEMENT_MESSAGES.REVOKE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{TEACHER_MANAGEMENT_MESSAGES.REVOKE_ERROR}</AlertTitle>
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
            onClick={handleRevoke}
          >
            {isPending
              ? TEACHER_MANAGEMENT_MESSAGES.REVOKING
              : TEACHER_MANAGEMENT_MESSAGES.REVOKE_ACTION}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
