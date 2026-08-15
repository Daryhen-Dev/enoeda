"use client";

import { AlertTriangleIcon, UserIcon } from "lucide-react";

import type { SessionView } from "@/lib/domain/classes/actions";
import { AttendanceSheetDialog } from "@/components/attendance/attendance-sheet-dialog";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";

interface SessionBlockProps {
  session: SessionView;
  compact?: boolean;
}

/**
 * Color mapping by discipline code.
 * Karate = blue, Kickboxing = red. Extensible via code.
 */
function getDisciplineColors(code: string): { bg: string; text: string; border: string } {
  switch (code) {
    case "karate":
      return {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-300",
      };
    case "kickboxing":
      return {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-300",
      };
    default:
      return {
        bg: "bg-gray-100",
        text: "text-gray-800",
        border: "border-gray-300",
      };
  }
}

export function SessionBlock({ session, compact = false }: SessionBlockProps) {
  const colors = getDisciplineColors(session.discipline_code);
  const isSuspended = session.status === "suspended";
  const hasNoTeacher = !session.teacher_id;
  const isSubstitute = session.is_substitute;

  const baseClasses = `rounded border px-1.5 py-0.5 text-xs ${colors.bg} ${colors.text}`;

  // Visual state modifiers
  const suspendedClasses = isSuspended ? "line-through opacity-70" : "";
  const noTeacherClasses = hasNoTeacher
    ? "border-dashed border-amber-500"
    : colors.border;

  if (compact) {
    return (
      <div
        className={`${baseClasses} ${suspendedClasses} ${noTeacherClasses} truncate`}
        title={`${session.discipline_name} ${session.start_time}–${session.end_time}`}
      >
        <span className="font-medium">{session.start_time}</span>{" "}
        {session.discipline_name.slice(0, 3)}
        {isSuspended && session.suspension_category && (
          <span className="ml-0.5 rounded bg-amber-200 px-0.5 text-[10px]">
            {session.suspension_category}
          </span>
        )}
        {isSubstitute && (
          <span className="ml-0.5 rounded bg-purple-200 px-0.5 text-[10px]">
            {CALENDAR_MESSAGES.SUBSTITUTE.slice(0, 3)}
          </span>
        )}
        {hasNoTeacher && (
          <AlertTriangleIcon className="ml-0.5 inline size-3 text-amber-600" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${suspendedClasses} ${noTeacherClasses} flex flex-col gap-0.5`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {session.start_time}–{session.end_time}
        </span>
        {isSuspended && session.suspension_category && (
          <span className="rounded bg-amber-200 px-1 text-[10px] font-medium">
            {session.suspension_category}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span>{session.discipline_name}</span>
        {isSubstitute && (
          <span className="rounded bg-purple-200 px-1 text-[10px]">
            <UserIcon className="mr-0.5 inline size-3" />
            {CALENDAR_MESSAGES.SUBSTITUTE}
          </span>
        )}
        {hasNoTeacher && (
          <span className="flex items-center gap-0.5 text-amber-600">
            <AlertTriangleIcon className="size-3" />
            <span className="text-[10px]">{CALENDAR_MESSAGES.NO_TEACHER}</span>
          </span>
        )}
      </div>
      <div className="mt-1">
        <AttendanceSheetDialog
          scheduledClassId={session.scheduled_class_id}
          sessionDate={session.session_date}
          disabled={isSuspended}
        />
      </div>
    </div>
  );
}
