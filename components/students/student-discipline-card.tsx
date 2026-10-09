"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { EllipsisVerticalIcon } from "lucide-react"

import { AttendanceStatsBadge } from "@/components/attendance/attendance-stats-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PromoteStudentDialog } from "@/components/students/promote-student-dialog"
import { RegisterClassPaymentDialog } from "@/components/payments/register-class-payment-dialog"
import { RegisterMonthlyPaymentDialog } from "@/components/payments/register-monthly-payment-dialog"
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
import {
  reactivateEnrollment,
  setEnrollmentBillingMode,
  suspendEnrollment,
} from "@/lib/domain/disciplines/actions"
import type { StudentDisciplineRecord } from "@/lib/domain/disciplines/actions"
import type { LevelRecord } from "@/lib/domain/levels/actions"
import type { StudentProgressSummary } from "@/lib/domain/progress/actions"
import {
  COMMON_MESSAGES,
  ENROLLMENT_MESSAGES,
  formatDate,
  formatNumber,
  PROGRESS_MESSAGES,
  STUDENT_DETAIL_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

export interface DisciplineAttendanceStats {
  present: number
  total: number
  percentage: number
}

interface StudentDisciplineCardProps {
  enrollment: StudentDisciplineRecord
  /** Progression summary for this discipline; null when unavailable. */
  summary: StudentProgressSummary | null
  /** Attendance stats for this discipline; omitted when total is 0. */
  attendance: DisciplineAttendanceStats | null
  /** Latest monthly payment period_end; null when there are no monthly payments. */
  paidThrough: Date | null
  /** Levels of the discipline; promotion actions require at least one. */
  levels: LevelRecord[]
  canManage: boolean
  studentId: string
  branchId: string
}

/**
 * Card grouping everything about one enrollment: status and enrolled date,
 * level progression, attendance, monthly-payment coverage and the
 * discipline-scoped management actions.
 */
export function StudentDisciplineCard({
  enrollment,
  summary,
  attendance,
  paidThrough,
  levels,
  canManage,
  studentId,
  branchId,
}: StudentDisciplineCardProps) {
  const router = useRouter()
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const disciplineName = enrollment.discipline_name
  const isPerClass = enrollment.billing_mode === "per_class"

  function handleSuspend() {
    startTransition(async () => {
      const result = await suspendEnrollment({
        student_discipline_id: enrollment.id,
        branch_id: branchId,
      })
      if (result.success) {
        toast.success(TOAST_MESSAGES.ENROLLMENT_SUSPENDED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateEnrollment({
        student_discipline_id: enrollment.id,
        branch_id: branchId,
      })
      if (result.success) {
        toast.success(TOAST_MESSAGES.ENROLLMENT_REACTIVATED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleChangeBillingMode() {
    const nextMode = isPerClass ? "monthly" : "per_class"
    startTransition(async () => {
      const result = await setEnrollmentBillingMode({
        branch_id: branchId,
        student_discipline_id: enrollment.id,
        billing_mode: nextMode,
      })
      if (result.success) {
        toast.success(ENROLLMENT_MESSAGES.BILLING_MODE_CHANGED_TOAST)
        if (result.data!.removed_roster_entries > 0) {
          toast.info(
            ENROLLMENT_MESSAGES.BILLING_MODE_ROSTERS_REMOVED_TOAST(
              result.data!.removed_roster_entries
            )
          )
        }
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{disciplineName}</h3>
        <Badge variant={enrollment.is_active ? "default" : "secondary"}>
          {enrollment.is_active
            ? ENROLLMENT_MESSAGES.ACTIVE_LABEL
            : ENROLLMENT_MESSAGES.SUSPENDED_LABEL}
        </Badge>
        <Badge variant="secondary">
          {isPerClass
            ? ENROLLMENT_MESSAGES.BILLING_MODE_PER_CLASS
            : ENROLLMENT_MESSAGES.BILLING_MODE_MONTHLY}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {ENROLLMENT_MESSAGES.ENROLLED_LABEL}{" "}
          {formatDate(new Date(enrollment.enrolled_at))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {summary &&
          (summary.current_level_name ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">
                {PROGRESS_MESSAGES.CURRENT_LEVEL}:
              </span>
              {summary.current_level_color && (
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: summary.current_level_color }}
                />
              )}
              <span>{summary.current_level_name}</span>
              {summary.next_level_name && !summary.is_max_level && (
                <>
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    →
                  </span>
                  {summary.next_level_color && (
                    <span
                      aria-hidden="true"
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: summary.next_level_color }}
                    />
                  )}
                  <span>{summary.next_level_name}</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {summary.is_max_level
                  ? PROGRESS_MESSAGES.ACCUMULATED_CLASSES(
                      formatNumber(summary.attended_sessions)
                    )
                  : PROGRESS_MESSAGES.CLASSES_TO_NEXT_LEVEL(
                      formatNumber(summary.attended_sessions),
                      formatNumber(summary.next_level_required_sessions ?? 0)
                    )}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {PROGRESS_MESSAGES.NO_LEVEL_ASSIGNED}
            </p>
          ))}

        {attendance && attendance.total > 0 && (
          <AttendanceStatsBadge
            present={attendance.present}
            total={attendance.total}
            percentage={attendance.percentage}
          />
        )}

        <span className="text-sm text-muted-foreground">
          {paidThrough
            ? `${STUDENT_DETAIL_MESSAGES.PAID_THROUGH_LABEL} ${formatDate(paidThrough)}`
            : STUDENT_DETAIL_MESSAGES.NO_MONTHLY_PAYMENTS}
        </span>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {enrollment.is_active ? (
            <>
              {!isPerClass && (
                <RegisterMonthlyPaymentDialog
                  studentDisciplineId={enrollment.id}
                  branchId={branchId}
                  triggerVariant="default"
                  triggerAriaLabel={STUDENT_DETAIL_MESSAGES.MONTHLY_PAYMENT_ARIA(
                    disciplineName
                  )}
                />
              )}
              <RegisterClassPaymentDialog
                studentDisciplineId={enrollment.id}
                branchId={branchId}
                triggerAriaLabel={STUDENT_DETAIL_MESSAGES.CLASS_PAYMENT_ARIA(
                  disciplineName
                )}
              />
              {levels.length > 0 && (
                <PromoteStudentDialog
                  studentId={studentId}
                  disciplineId={enrollment.discipline_id}
                  disciplineName={disciplineName}
                  levels={levels}
                  branchId={branchId}
                  mode="promote"
                  triggerAriaLabel={STUDENT_DETAIL_MESSAGES.PROMOTE_ARIA(
                    disciplineName
                  )}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={STUDENT_DETAIL_MESSAGES.MORE_ACTIONS_ARIA(
                        disciplineName
                      )}
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {levels.length > 0 && (
                      <DropdownMenuItem
                        onClick={() => setCorrectionOpen(true)}
                        aria-label={`${PROGRESS_MESSAGES.CORRECT_PROMOTION_ACTION}: ${disciplineName}`}
                      >
                        {PROGRESS_MESSAGES.CORRECT_PROMOTION_ACTION}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isPending}
                      onClick={handleSuspend}
                      aria-label={`${ENROLLMENT_MESSAGES.SUSPEND_ACTION}: ${disciplineName}`}
                    >
                      {ENROLLMENT_MESSAGES.SUSPEND_ACTION}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      aria-label={`${ENROLLMENT_MESSAGES.CHANGE_BILLING_MODE_ACTION}: ${disciplineName}`}
                    />
                  }
                >
                  {ENROLLMENT_MESSAGES.CHANGE_BILLING_MODE_ACTION}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {ENROLLMENT_MESSAGES.BILLING_MODE_DIALOG_TITLE}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isPerClass
                        ? ENROLLMENT_MESSAGES.BILLING_MODE_TO_MONTHLY_DESCRIPTION
                        : ENROLLMENT_MESSAGES.BILLING_MODE_TO_PER_CLASS_DESCRIPTION}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{COMMON_MESSAGES.CANCEL}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isPending}
                      onClick={handleChangeBillingMode}
                      aria-label={`${ENROLLMENT_MESSAGES.BILLING_MODE_CONFIRM}: ${disciplineName}`}
                    >
                      {ENROLLMENT_MESSAGES.BILLING_MODE_CONFIRM}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <PromoteStudentDialog
                studentId={studentId}
                disciplineId={enrollment.discipline_id}
                disciplineName={disciplineName}
                levels={levels}
                branchId={branchId}
                mode="correction"
                correctionOpen={correctionOpen}
                onCorrectionOpenChange={setCorrectionOpen}
              />
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleReactivate}
              aria-label={`${ENROLLMENT_MESSAGES.REACTIVATE_ACTION}: ${disciplineName}`}
            >
              {ENROLLMENT_MESSAGES.REACTIVATE_ACTION}
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
