"use client";

import { useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CirclePauseIcon, EraserIcon, UserIcon, UserPenIcon } from "lucide-react";
import { toast } from "sonner";

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
} from "@/components/ui/alert-dialog";
import { AttendanceSheetDialog } from "@/components/attendance/attendance-sheet-dialog";
import { SessionInfoSheetDialog } from "@/components/attendance/session-info-sheet-dialog";
import { OneTimeTeacherDialog } from "@/components/classes/one-time-teacher-dialog";
import { RemoveRecurringClassDialog } from "@/components/classes/remove-recurring-class-dialog";
import { SessionSuspendDialog } from "@/components/classes/session-suspend-dialog";
import { TeacherAssignDialog } from "@/components/classes/teacher-assign-dialog";
import {
  RosterEditorSheet,
  type RosterEditorTarget,
} from "@/components/rosters/roster-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SealMark } from "@/components/dashboard/seal-mark";
import {
  clearSessionSubstitution,
  reinstateSession,
  type SessionView,
} from "@/lib/domain/classes/actions";
import {
  ATTENDANCE_FORM_MESSAGES,
  CALENDAR_MESSAGES,
  COMMON_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
  ONE_TIME_CLASS_MESSAGES,
  ROSTER_EDITOR_MESSAGES,
  SUSPENSION_MESSAGES,
  TEACHER_ASSIGN_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
} from "@/lib/localization/es-ec";
import { cn } from "@/lib/utils";

interface SessionBlockProps {
  session: SessionView;
  compact?: boolean;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

// Action buttons come from the shared `buttonVariants`: one filled primary
// action per card ("Tomar asistencia"), outline for the neutral ones, and
// outline plus carmine text for the destructive ones (DESIGN.md forbids
// solid destructive fills). The block authors no palette utility and no
// `dark:` variant of its own — the single light theme is the only theme.

/**
 * Group month label for recurring sessions, e.g. "octubre de 2026" —
 * same es-EC formatting as the class-schedules list (duplicated here to
 * keep the calendar block dependency-free).
 */
function formatGroupMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const rawLabel = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
}

/**
 * Undoes a day substitution ("Quitar sustitución"): confirms and clears
 * the session's assigned_teacher_id override, so the occurrence goes back
 * to the group's default teacher. Rendered only for recurring sessions
 * with an active substitution. Admin-only UI: the block renders behind
 * the calendar's canManage gate and the action re-asserts authorization
 * server-side.
 */
function ClearSubstitutionAction({
  scheduledClassId,
  sessionDate,
  branchId,
  triggerClassName,
}: {
  scheduledClassId: string;
  sessionDate: string;
  branchId: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await clearSessionSubstitution({
        branch_id: branchId,
        scheduled_class_id: scheduledClassId,
        session_date: sessionDate,
      });

      if (result.success) {
        setOpen(false);
        toast.success(
          result.data?.cleared
            ? TEACHER_ASSIGN_MESSAGES.SUBSTITUTION_CLEARED
            : TEACHER_ASSIGN_MESSAGES.SUBSTITUTION_NONE
        );
        router.refresh();
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_TRIGGER_ARIA_LABEL(
              sessionDate
            )}
            className={triggerClassName}
          />
        }
      >
        <EraserIcon aria-hidden="true" data-icon="inline-start" />
        {TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
            {isPending
              ? COMMON_MESSAGES.LOADING
              : TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_CONFIRM}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      "button, [role=button], a, input, textarea, select, label, [contenteditable]"
    )
  );
}

function isMobileCalendarViewport(): boolean {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function hasSessionAttendance(
  session: SessionView
): session is SessionView & {
  attendance: NonNullable<SessionView["attendance"]>;
} {
  return session.attendance !== undefined;
}

export function SessionBlock({
  session,
  compact = false,
  teachers = [],
  canManage = false,
  branchId,
}: SessionBlockProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSessionInfoOpen, setIsSessionInfoOpen] = useState(false);
  const [rosterTarget, setRosterTarget] = useState<RosterEditorTarget | null>(null);
  const isSuspended = session.status === "suspended";
  const hasNoTeacher = !session.teacher_id;
  const isSubstitute = session.is_substitute;
  const isOneTime = session.is_one_time;
  const canViewAttendance = session.can_view_attendance === true;
  // Ledger state, derived exactly like the dashboard agenda so the block,
  // the agenda and the ledger panels name the same three states.
  const isSealed = !isSuspended && (session.attendance?.record_count ?? 0) > 0;
  const hasAttendanceRecords = canViewAttendance && isSealed;
  const teacherLabel = hasNoTeacher
    ? CALENDAR_MESSAGES.NO_TEACHER
    : session.effective_teacher_name
      ? CALENDAR_MESSAGES.TEACHER_DISPLAY_NAME(session.effective_teacher_name)
      : CALENDAR_MESSAGES.TEACHER_PROFILE_UNAVAILABLE;
  const sessionInfoLabel = CALENDAR_MESSAGES.SESSION_INFO_ARIA_LABEL(
    session.discipline_name,
    session.start_time,
    session.session_date
  );
  const seriesRosterTarget: RosterEditorTarget | null =
    !isOneTime && session.series_id
      ? { kind: "series", series_id: session.series_id }
      : null;

  function openSessionInfoIfAllowed(target: EventTarget | null) {
    if (!canViewAttendance || isInteractiveTarget(target)) return;
    setIsSessionInfoOpen(true);
  }

  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if (!canViewAttendance || !isMobileCalendarViewport() || event.defaultPrevented) return;
    openSessionInfoIfAllowed(event.target);
  }

  function handleCardDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!canViewAttendance || isMobileCalendarViewport() || event.defaultPrevented) return;
    openSessionInfoIfAllowed(event.target);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !canViewAttendance ||
      event.defaultPrevented ||
      event.currentTarget !== event.target
    ) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    setIsSessionInfoOpen(true);
  }

  function handleReinstate() {
    if (!branchId) return;

    startTransition(async () => {
      const result = await reinstateSession({
        scheduled_class_id: session.scheduled_class_id,
        session_date: session.session_date,
        branch_id: branchId,
      });

      if (result.success) {
        toast.success(SUSPENSION_MESSAGES.REINSTATED);
        router.refresh();
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    });
  }

  const baseClasses = compact
    ? "rounded px-1.5 py-1 text-sm leading-4"
    : "rounded border text-sm";
  const suspendedClasses = isSuspended ? "line-through opacity-70" : "";
  // Scheduled and attended work sits on the paper card; suspended work
  // prints in retired grey (the Print-Grey Rule), never on a color tint.
  // A missing teacher is an actionable problem, so its rule turns carmine.
  const cardStateClasses = compact
    ? isSuspended
      ? "bg-muted text-muted-foreground"
      : "bg-card text-foreground"
    : isSuspended
      ? "border-border bg-muted text-muted-foreground"
      : hasNoTeacher
        ? "border-dashed border-destructive bg-card text-foreground"
        : "border-border bg-card text-foreground";
  // One status vocabulary, shared with the agenda and the ledger panels:
  // seal for recorded attendance, the agenda's pending pill for open work,
  // the retired word for suspensions.
  const compactStatus = isSuspended
    ? CALENDAR_MESSAGES.SUSPENDED_BADGE
    : isSealed
      ? ATTENDANCE_FORM_MESSAGES.SEAL_LABEL
      : DASHBOARD_OVERVIEW_MESSAGES.ATTENDANCE_PENDING;
  const compactStatusBadgeClasses = isSuspended
    ? "border border-border bg-muted text-muted-foreground"
    : isSealed
      ? "border border-seal/40 bg-seal/5 text-foreground"
      : "border border-border text-foreground";
  const compactTitle = [
    `${session.discipline_name} ${session.start_time}–${session.end_time}`,
    compactStatus,
    hasAttendanceRecords && !isSuspended
      ? CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(
          session.attendance?.present_count ?? 0
        )
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <>
        <div
          className={`${baseClasses} ${cardStateClasses} flex flex-col items-start gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          title={compactTitle}
          tabIndex={0}
          role="group"
          aria-label={sessionInfoLabel}
          onClick={handleCardClick}
          onDoubleClick={handleCardDoubleClick}
          onKeyDown={handleCardKeyDown}
        >
          <span className="font-medium">{session.start_time}</span>
          <span className="w-full truncate">{session.discipline_name}</span>
          <span
            className={`rounded px-1 text-xs font-medium ${compactStatusBadgeClasses}`}
          >
            {compactStatus}
          </span>
          {isSubstitute && (
            <Badge variant="secondary">
              {CALENDAR_MESSAGES.SUBSTITUTE.slice(0, 3)}
            </Badge>
          )}
          {isOneTime && (
            <Badge variant="outline">
              {ONE_TIME_CLASS_MESSAGES.ONE_TIME_BADGE}
            </Badge>
          )}
          {hasAttendanceRecords && (
            <span className="rounded border border-seal/40 bg-seal/5 px-1 text-sm font-medium text-seal tabular-nums">
              {CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(
                session.attendance?.present_count ?? 0
              )}
            </span>
          )}
        </div>
        {canViewAttendance && hasSessionAttendance(session) && (
          <SessionInfoSheetDialog
            session={session}
            branchId={branchId ?? ""}
            open={isSessionInfoOpen}
            onOpenChange={setIsSessionInfoOpen}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`${baseClasses} ${suspendedClasses} ${cardStateClasses} flex min-h-32 flex-col gap-2 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        tabIndex={0}
        role="group"
        aria-label={sessionInfoLabel}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
        onKeyDown={handleCardKeyDown}
      >
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium">
            {session.start_time}–{session.end_time}
          </span>
          {isSuspended && (
            <span className="rounded border border-border px-1 text-xs font-medium">
              {CALENDAR_MESSAGES.SUSPENDED_BADGE}
            </span>
          )}
          {isSuspended && session.suspension_category && (
            <span className="rounded border border-border px-1 text-xs font-medium">
              {session.suspension_category}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm font-medium">{session.discipline_name}</span>
          {!isOneTime && session.series_name && (
            <span className="text-xs text-muted-foreground">
              {session.series_name}
              {session.period_month
                ? ` · ${formatGroupMonth(session.period_month)}`
                : ""}
            </span>
          )}
          {isSubstitute && (
            <Badge variant="secondary">
              <UserIcon data-icon="inline-start" />
              {CALENDAR_MESSAGES.SUBSTITUTE}
            </Badge>
          )}
          {isOneTime && (
            <Badge variant="outline">
              {ONE_TIME_CLASS_MESSAGES.ONE_TIME_BADGE}
            </Badge>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-sm",
            hasNoTeacher ? "text-destructive" : "font-medium text-foreground"
          )}
        >
          {hasNoTeacher ? <AlertTriangleIcon className="size-3" /> : <UserIcon className="size-3" />}
          <span>{teacherLabel}</span>
        </div>
        {canViewAttendance && !isSuspended && (
          isSealed ? (
            <div className="flex items-center gap-2 rounded-md border border-seal/40 bg-seal/5 px-2 py-1">
              <SealMark />
              <span className="text-sm font-medium text-seal tabular-nums">
                {CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(
                  session.attendance?.present_count ?? 0
                )}
              </span>
            </div>
          ) : (
            <span className="inline-flex w-fit items-center rounded-4xl border border-border px-2 text-xs font-medium text-foreground">
              {DASHBOARD_OVERVIEW_MESSAGES.ATTENDANCE_PENDING}
            </span>
          )
        )}
        <div className="mt-1 flex flex-col items-stretch gap-2">
          {isOneTime ? (
            <>
              {canViewAttendance && (
                <AttendanceSheetDialog
                  oneTimeClassId={session.scheduled_class_id}
                  sessionDate={session.session_date}
                  branchId={branchId ?? ""}
                  disabled={isSuspended || !branchId || !session.can_take_attendance}
                  triggerClassName={buttonVariants({ variant: "default", size: "sm" })}
                />
              )}
              {canManage && branchId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRosterTarget({
                      kind: "one_time",
                      one_time_class_id: session.scheduled_class_id,
                    })
                  }
                >
                  {ROSTER_EDITOR_MESSAGES.ROSTER_ONE_TIME_ACTION}
                </Button>
              )}
              {canManage && branchId && (
                <OneTimeTeacherDialog
                  oneTimeClassId={session.scheduled_class_id}
                  branchId={branchId}
                  teachers={teachers}
                  currentTeacherId={session.teacher_id}
                  triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
                  trigger={
                    <>
                      <UserPenIcon data-icon="inline-start" />
                      {hasNoTeacher
                        ? TEACHER_CONFLICT_MESSAGES.ASSIGN_ACTION
                        : TEACHER_CONFLICT_MESSAGES.CHANGE_ACTION}
                    </>
                  }
                />
              )}
            </>
          ) : (
            <>
              {canViewAttendance && (
                <AttendanceSheetDialog
                  scheduledClassId={session.scheduled_class_id}
                  sessionDate={session.session_date}
                  branchId={branchId ?? ""}
                  disabled={isSuspended || !branchId || !session.can_take_attendance}
                  triggerClassName={buttonVariants({ variant: "default", size: "sm" })}
                />
              )}
              {canManage && branchId && seriesRosterTarget && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRosterTarget(seriesRosterTarget)}
                >
                  {ROSTER_EDITOR_MESSAGES.ROSTER_SERIES_ACTION}
                </Button>
              )}
              {canManage && branchId && (
                <>
                  {session.status === "scheduled" ? (
                    <SessionSuspendDialog
                      scheduledClassId={session.scheduled_class_id}
                      sessionDate={session.session_date}
                      branchId={branchId}
                      trigger={
                        <>
                          <CirclePauseIcon data-icon="inline-start" />
                          {SUSPENSION_MESSAGES.SUSPEND_TITLE}
                        </>
                      }
                      triggerClassName={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "text-destructive"
                      )}
                    />
                  ) : isSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={handleReinstate}
                    >
                      {isPending
                        ? COMMON_MESSAGES.LOADING
                        : SUSPENSION_MESSAGES.REINSTATE_ACTION}
                    </Button>
                  ) : null}
                  <TeacherAssignDialog
                    scheduledClassId={session.scheduled_class_id}
                    sessionDate={session.session_date}
                    branchId={branchId}
                    teachers={teachers}
                    currentTeacherId={session.teacher_id}
                    triggerText={
                      hasNoTeacher
                        ? TEACHER_CONFLICT_MESSAGES.ASSIGN_ACTION
                        : TEACHER_CONFLICT_MESSAGES.CHANGE_ACTION
                    }
                    triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
                  />
                  {isSubstitute && (
                    <ClearSubstitutionAction
                      scheduledClassId={session.scheduled_class_id}
                      sessionDate={session.session_date}
                      branchId={branchId}
                      triggerClassName={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    />
                  )}
                  <RemoveRecurringClassDialog
                    scheduledClassId={session.scheduled_class_id}
                    branchId={branchId}
                    disciplineName={session.discipline_name}
                    startTime={session.start_time}
                    triggerClassName={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "text-destructive"
                    )}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
      {rosterTarget && (
        <RosterEditorSheet
          branchId={branchId ?? ""}
          target={rosterTarget}
          open={rosterTarget !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setRosterTarget(null);
          }}
        />
      )}
      {canViewAttendance && hasSessionAttendance(session) && (
        <SessionInfoSheetDialog
          session={session}
          branchId={branchId ?? ""}
          open={isSessionInfoOpen}
          onOpenChange={setIsSessionInfoOpen}
        />
      )}
    </>
  );
}
