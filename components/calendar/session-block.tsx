"use client";

import { useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CirclePauseIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { AttendanceSheetDialog } from "@/components/attendance/attendance-sheet-dialog";
import { SessionInfoSheetDialog } from "@/components/attendance/session-info-sheet-dialog";
import { SessionSuspendDialog } from "@/components/classes/session-suspend-dialog";
import { TeacherAssignDialog } from "@/components/classes/teacher-assign-dialog";
import { Button } from "@/components/ui/button";
import { reinstateSession, type SessionView } from "@/lib/domain/classes/actions";
import {
  CALENDAR_MESSAGES,
  COMMON_MESSAGES,
  ONE_TIME_CLASS_MESSAGES,
  SUSPENSION_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
} from "@/lib/localization/es-ec";

interface SessionBlockProps {
  session: SessionView;
  compact?: boolean;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

interface DisciplineColors {
  bg: string;
  text: string;
  border: string;
}

function getDisciplineColors(code: string): DisciplineColors {
  switch (code) {
    case "karate":
      return { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" };
    case "kickboxing":
      return { bg: "bg-amber-50", text: "text-amber-950", border: "border-amber-200" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-300" };
  }
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
  const colors = getDisciplineColors(session.discipline_code);
  const isSuspended = session.status === "suspended";
  const hasNoTeacher = !session.teacher_id;
  const isSubstitute = session.is_substitute;
  const isOneTime = session.is_one_time;
  const canViewAttendance = session.can_view_attendance === true;
  const hasAttendanceRecords =
    canViewAttendance && (session.attendance?.record_count ?? 0) > 0;
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
    : `rounded border text-sm ${colors.bg} ${colors.text}`;
  const suspendedClasses = isSuspended ? "line-through opacity-70" : "";
  const noTeacherClasses = hasNoTeacher
    ? "border-dashed border-amber-500"
    : colors.border;
  const compactStatus = isSuspended
    ? CALENDAR_MESSAGES.COMPACT_STATUS_SUSPENDED
    : hasAttendanceRecords
      ? CALENDAR_MESSAGES.COMPACT_STATUS_COMPLETED
      : CALENDAR_MESSAGES.COMPACT_STATUS_SCHEDULED;
  const compactStateClasses = isSuspended
    ? "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-red-200"
    : hasAttendanceRecords
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
      : "bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100";
  const compactStatusBadgeClasses = isSuspended
    ? "bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-100"
    : hasAttendanceRecords
      ? "bg-emerald-200/70 text-emerald-950 dark:bg-emerald-900/70 dark:text-emerald-100"
      : "bg-amber-200/70 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100";
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
          className={`${baseClasses} ${compactStateClasses} flex flex-col items-start gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
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
          <span className={`rounded px-1 text-xs font-medium ${compactStatusBadgeClasses}`}>
            {compactStatus}
          </span>
          {isSubstitute && (
            <span className="rounded bg-purple-200 px-0.5 text-xs">
              {CALENDAR_MESSAGES.SUBSTITUTE.slice(0, 3)}
            </span>
          )}
          {isOneTime && (
            <span className="rounded bg-sky-200 px-0.5 text-xs">
              {ONE_TIME_CLASS_MESSAGES.ONE_TIME_BADGE}
            </span>
          )}
          {hasAttendanceRecords && !isSuspended && (
            <span className="rounded bg-emerald-200/70 px-1 text-sm font-medium text-emerald-950 dark:bg-emerald-900/70 dark:text-emerald-100">
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
        className={`${baseClasses} ${suspendedClasses} ${noTeacherClasses} flex min-h-32 flex-col gap-2 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
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
          {isSuspended && session.suspension_category && (
            <span className="rounded bg-amber-200 px-1 text-xs font-medium">
              {session.suspension_category}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <span>{session.discipline_name}</span>
          {isSubstitute && (
            <span className="rounded bg-purple-200 px-1 text-xs">
              <UserIcon className="mr-0.5 inline size-3" />
              {CALENDAR_MESSAGES.SUBSTITUTE}
            </span>
          )}
          {isOneTime && (
            <span className="rounded bg-sky-200 px-1 text-xs">
              {ONE_TIME_CLASS_MESSAGES.ONE_TIME_BADGE}
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-1 text-sm ${
            hasNoTeacher
              ? "text-amber-700"
              : "font-medium text-slate-950 dark:text-slate-950"
          }`}
        >
          {hasNoTeacher ? <AlertTriangleIcon className="size-3" /> : <UserIcon className="size-3" />}
          <span>{teacherLabel}</span>
        </div>
        {canViewAttendance && !isSuspended && (
          <div className="rounded bg-white/70 px-2 py-1 text-sm font-medium text-slate-900 shadow-sm dark:bg-slate-950/80 dark:text-slate-100">
            {CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(
              session.attendance?.present_count ?? 0
            )}
          </div>
        )}
        <div className="mt-1 flex flex-col items-stretch gap-2">
          {isOneTime ? (
            canViewAttendance && (
              <AttendanceSheetDialog
                oneTimeClassId={session.scheduled_class_id}
                sessionDate={session.session_date}
                branchId={branchId ?? ""}
                disabled={isSuspended || !branchId || !session.can_take_attendance}
                triggerClassName="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-sky-600 bg-sky-600 px-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-sky-700 hover:text-white focus-visible:border-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-950/50 disabled:pointer-events-none disabled:opacity-50"
              />
            )
          ) : (
            <>
              {canViewAttendance && (
                <AttendanceSheetDialog
                  scheduledClassId={session.scheduled_class_id}
                  sessionDate={session.session_date}
                  branchId={branchId ?? ""}
                  disabled={isSuspended || !branchId || !session.can_take_attendance}
                  triggerClassName="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-sky-600 bg-sky-600 px-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-sky-700 hover:text-white focus-visible:border-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-950/50 disabled:pointer-events-none disabled:opacity-50"
                />
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
                      triggerClassName="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-destructive bg-destructive px-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-red-700 hover:text-white focus-visible:border-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-950/50 disabled:pointer-events-none disabled:opacity-50"
                    />
                  ) : isSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={handleReinstate}
                      className="h-8 w-full rounded-full border-emerald-600 bg-emerald-600 px-2 text-sm text-white shadow-sm hover:bg-emerald-700 hover:text-white focus-visible:border-emerald-950 focus-visible:ring-emerald-950/50"
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
                    triggerClassName="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-purple-600 bg-purple-600 px-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-purple-700 hover:text-white focus-visible:border-purple-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-950/50 disabled:pointer-events-none disabled:opacity-50"
                  />
                </>
              )}
            </>
          )}
        </div>
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
