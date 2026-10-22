import Link from "next/link"

import { AttendanceSheetDialog } from "@/components/attendance/attendance-sheet-dialog"
import { SealMark } from "@/components/dashboard/seal-mark"
import { buttonVariants } from "@/components/ui/button"
import type { SessionView } from "@/lib/domain/classes/actions"
import {
  buildTodayAgenda,
  type TodayAgendaEntry,
} from "@/lib/domain/dashboard"
import {
  CALENDAR_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
} from "@/lib/localization/es-ec"

const HEADING_ID = "today-agenda-heading"

interface AgendaRowStateCellProps {
  session: TodayAgendaEntry
  branchId: string
}

/**
 * State cell of a ledger row. Sealed rows carry the vermilion seal mark and
 * a quiet ghost trigger; pending rows show an ink outline pill and the
 * primary "Tomar asistencia" trigger; suspended rows print grey with no
 * attendance action.
 */
function AgendaRowStateCell({ session, branchId }: AgendaRowStateCellProps) {
  if (session.state === "suspended") {
    return (
      <div className="flex min-w-0 flex-col items-start text-left sm:items-end sm:text-right">
        <span className="text-sm text-muted-foreground">
          {CALENDAR_MESSAGES.SUSPENDED_BADGE}
        </span>
        {session.suspension_reason && (
          <span className="truncate text-xs text-muted-foreground">
            {session.suspension_reason}
          </span>
        )}
      </div>
    )
  }

  const canViewAttendance = session.can_view_attendance === true

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start sm:gap-1.5">
      {session.state === "sealed" ? (
        <div className="flex items-center gap-2">
          <SealMark />
          {canViewAttendance && (
            <span className="text-sm tabular-nums">
              {CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(
                session.attendance?.present_count ?? 0
              )}
            </span>
          )}
        </div>
      ) : (
        <span className="inline-flex h-5 items-center rounded-4xl border border-border px-2 text-xs font-medium text-foreground">
          {DASHBOARD_OVERVIEW_MESSAGES.ATTENDANCE_PENDING}
        </span>
      )}
      {canViewAttendance && (
        <AttendanceSheetDialog
          {...(session.is_one_time
            ? { oneTimeClassId: session.scheduled_class_id }
            : { scheduledClassId: session.scheduled_class_id })}
          sessionDate={session.session_date}
          branchId={branchId}
          disabled={!session.can_take_attendance}
          triggerLabel={
            session.state === "sealed"
              ? DASHBOARD_OVERVIEW_MESSAGES.VIEW_ATTENDANCE
              : undefined
          }
          triggerClassName={`ml-auto sm:ml-0 ${buttonVariants({
            variant: session.state === "sealed" ? "ghost" : "default",
            size: "sm",
          })}`}
        />
      )}
    </div>
  )
}

interface TodayAgendaPanelProps {
  sessions: SessionView[]
  branchId: string
  /** Load-failure message from the server action; null when sessions loaded. */
  loadError?: string | null
}

/**
 * Work area (A) of the dashboard overview: today's classes as ruled ledger
 * lines, each closing with its attendance state — the seal for recorded
 * sessions, open ink for pending ones, retired grey for suspensions.
 * Server component; the attendance trigger is a client dialog rendered with
 * serializable props. Ids are passed exactly like the calendar's
 * session-block: one-time classes use oneTimeClassId, recurring ones use
 * scheduledClassId + sessionDate.
 */
export function TodayAgendaPanel({
  sessions,
  branchId,
  loadError = null,
}: TodayAgendaPanelProps) {
  const agenda = buildTodayAgenda(sessions)
  const calendarHref = `/dashboard/calendar?branch=${encodeURIComponent(branchId)}`

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3 md:px-5">
        <h3 id={HEADING_ID} className="text-lg font-semibold tracking-[-0.01em]">
          {DASHBOARD_OVERVIEW_MESSAGES.TODAY_CLASSES}
        </h3>
      </div>

      {loadError !== null ? (
        <p
          role="alert"
          className="mx-4 my-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive md:mx-5"
        >
          {loadError}
        </p>
      ) : agenda.entries.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-4 py-6 md:px-5">
          <p className="text-sm text-muted-foreground">
            {CALENDAR_MESSAGES.DAY_EMPTY_STATE}
          </p>
          <Link
            href={calendarHref}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {DASHBOARD_OVERVIEW_MESSAGES.CALENDAR_LINK}
          </Link>
        </div>
      ) : (
        <ul aria-label={DASHBOARD_OVERVIEW_MESSAGES.TODAY_CLASSES}>
          {agenda.entries.map((session) => (
            <li
              key={session.scheduled_class_id}
              className={`flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-3 md:px-5 ${
                session.state === "suspended" ? "text-muted-foreground" : ""
              }`}
            >
              {/* Mobile: time + class on the first line, state and action on
                  the second; from sm up, one ruled line. */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-24 shrink-0 text-sm tabular-nums">
                {session.start_time}–{session.end_time}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {session.discipline_name}
                  {session.series_name && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      {session.series_name}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.effective_teacher_name
                    ? CALENDAR_MESSAGES.TEACHER_DISPLAY_NAME(
                        session.effective_teacher_name
                      )
                    : CALENDAR_MESSAGES.NO_TEACHER}
                  {session.is_substitute && ` · ${CALENDAR_MESSAGES.SUBSTITUTE}`}
                </p>
              </div>
              </div>
              <AgendaRowStateCell session={session} branchId={branchId} />
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-2.5 md:px-5">
        <Link
          href={calendarHref}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {DASHBOARD_OVERVIEW_MESSAGES.CALENDAR_LINK}
        </Link>
      </div>
    </section>
  )
}
