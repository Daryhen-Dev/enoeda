"use client";

import { parseDateOnly } from "@/lib/date";
import type { SessionView } from "@/lib/domain/classes/actions";
import { SessionBlock } from "./session-block";

interface CalendarDayCellProps {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: SessionView[];
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  sessions,
  teachers = [],
  canManage = false,
  branchId,
}: CalendarDayCellProps) {
  const dayNumber = parseDateOnly(date).getDate();

  return (
    <div
      className={`min-h-24 min-w-0 rounded-md border p-1 ${
        !isCurrentMonth ? "bg-muted/30 opacity-50" : ""
      } ${isToday ? "border-primary" : "border-border"}`}
      aria-current={isToday ? "date" : undefined}
    >
      <div
        className={`mb-1 text-right text-sm font-medium ${
          isToday
            ? "inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "text-muted-foreground"
        }`}
      >
        {dayNumber}
      </div>
      <div className="flex flex-col gap-0.5">
        {sessions.map((session) => (
          <SessionBlock
            key={`${session.scheduled_class_id}-${session.session_date}`}
            session={session}
            compact
            teachers={teachers}
            canManage={canManage}
            branchId={branchId}
          />
        ))}
      </div>
    </div>
  );
}
