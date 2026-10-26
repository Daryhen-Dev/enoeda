import {
  AlertTriangleIcon,
  CalendarClockIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  getDueDateRemainingDays,
  getDueDateStatus,
  getNearestDueDiscipline,
} from "@/lib/domain/students/due-date"
import {
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_STATUS_STRIP_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

interface StripEnrollment {
  discipline_id: string
  discipline_name: string
  is_active: boolean
  suspended_at: Date | null
  /** Optional so callers that do not load billing keep working unchanged. */
  billing_mode?: "monthly" | "per_class"
  next_due_date?: string | null
}

interface StripAttendance {
  discipline_id: string
  present: number
  total: number
  percentage: number
}

interface StripProgress {
  discipline_id: string
  discipline_name: string
  current_level_name: string | null
  current_level_color: string | null
}

interface StripConduct {
  pending_fines_count: number
  pending_fines_total: number
  warnings_count: number
}

interface StudentStatusStripProps {
  /** Branch-timezone today (YYYY-MM-DD), so "vence en N días" matches the directory. */
  todayDateOnly: string
  enrollments: StripEnrollment[]
  attendanceStats: StripAttendance[]
  progress: StripProgress[]
  conduct: StripConduct
}

const LABEL_CLASSES =
  "text-[0.65rem] font-medium tracking-[0.08em] uppercase text-muted-foreground"

function averagePercentage(stats: StripAttendance[]): number | null {
  const withRecords = stats.filter((stat) => stat.total > 0)
  if (withRecords.length === 0) return null

  const total = withRecords.reduce((sum, stat) => sum + stat.percentage, 0)
  return Math.round(total / withRecords.length)
}

/**
 * One-line answer to "can this student train, do they owe me, do they show up,
 * and where are they in the belt path". Everything is already loaded by the
 * detail page, so this is presentation only: four chips instead of opening four
 * tabs.
 */
export function StudentStatusStrip({
  todayDateOnly,
  enrollments,
  attendanceStats,
  progress,
  conduct,
}: StudentStatusStripProps) {
  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.is_active
  )
  const suspended = activeEnrollments.some(
    (enrollment) => enrollment.suspended_at !== null
  )
  const attendance = averagePercentage(attendanceStats)
  // The due chip only appears when the caller loaded billing for the enrollments.
  const billingKnown = activeEnrollments.some(
    (enrollment) => enrollment.billing_mode !== undefined
  )
  const billable = activeEnrollments
    .filter((enrollment) => enrollment.billing_mode !== undefined)
    .map((enrollment) => ({
      ...enrollment,
      billing_mode: enrollment.billing_mode as "monthly" | "per_class",
      next_due_date: enrollment.next_due_date ?? null,
    }))
  const nearestDue = getNearestDueDiscipline(billable)
  const hasMonthly = billable.some((entry) => entry.billing_mode === "monthly")
  const dueRemaining =
    nearestDue?.next_due_date != null
      ? getDueDateRemainingDays(nearestDue.next_due_date, todayDateOnly)
      : null
  const levels = progress.filter((entry) =>
    activeEnrollments.some(
      (enrollment) => enrollment.discipline_id === entry.discipline_id
    )
  )

  return (
    <section
      aria-label={STUDENT_STATUS_STRIP_MESSAGES.LABEL}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      {suspended && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertTriangleIcon className="size-4" aria-hidden="true" />
          {STUDENT_STATUS_STRIP_MESSAGES.SUSPENDED}
        </p>
      )}

      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLASSES}>
          {STUDENT_STATUS_STRIP_MESSAGES.ACCOUNT_LABEL}
        </span>
        {conduct.pending_fines_count > 0 ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-destructive tabular-nums">
            <ReceiptTextIcon className="size-4" aria-hidden="true" />
            {STUDENT_STATUS_STRIP_MESSAGES.FINES(conduct.pending_fines_count)} ·{" "}
            {formatCurrency(conduct.pending_fines_total)}
          </span>
        ) : (
          <span className="text-sm">
            {STUDENT_STATUS_STRIP_MESSAGES.NO_FINES}
          </span>
        )}
      </div>

      {conduct.warnings_count > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLASSES}>
            {STUDENT_STATUS_STRIP_MESSAGES.CONDUCT_LABEL}
          </span>
          <span className="text-sm">
            {STUDENT_STATUS_STRIP_MESSAGES.WARNINGS(conduct.warnings_count)}
          </span>
        </div>
      )}

      {billingKnown && (
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLASSES}>
            {STUDENT_STATUS_STRIP_MESSAGES.DUE_LABEL}
          </span>
          {nearestDue?.next_due_date != null ? (
            <span
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium tabular-nums",
                dueRemaining !== null && dueRemaining < 0 && "text-destructive"
              )}
            >
              <CalendarClockIcon className="size-4" aria-hidden="true" />
              {nearestDue.discipline_name} ·{" "}
              {getDueDateStatus(nearestDue.next_due_date, todayDateOnly)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {hasMonthly
                ? STUDENT_DIRECTORY_MESSAGES.NO_PAYMENTS_REGISTERED
                : STUDENT_DIRECTORY_MESSAGES.PER_CLASS_DUE_DATE}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLASSES}>
          {STUDENT_STATUS_STRIP_MESSAGES.ATTENDANCE_LABEL}
        </span>
        {attendance === null ? (
          <span className="text-sm text-muted-foreground">
            {STUDENT_STATUS_STRIP_MESSAGES.NO_ATTENDANCE}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <TrendingUpIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {STUDENT_STATUS_STRIP_MESSAGES.ATTENDANCE(attendance)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <span className={LABEL_CLASSES}>
          {STUDENT_STATUS_STRIP_MESSAGES.LEVEL_LABEL}
        </span>
        {levels.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            {STUDENT_STATUS_STRIP_MESSAGES.NO_ACTIVE_DISCIPLINES}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            {levels.map((level) => (
              <Badge key={level.discipline_id} variant="secondary">
                {level.discipline_name}
                {level.current_level_name && ` · ${level.current_level_name}`}
              </Badge>
            ))}
          </span>
        )}
      </div>
    </section>
  )
}
