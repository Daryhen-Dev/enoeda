"use client";

import type { SessionView } from "@/lib/domain/classes/actions";
import { SessionBlock } from "./session-block";

interface CalendarDayCellProps {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: SessionView[];
}

export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  sessions,
}: CalendarDayCellProps) {
  const dayNumber = new Date(date).getDate();

  return (
    <div
      className={`min-h-24 rounded-md border p-1 ${
        !isCurrentMonth ? "bg-muted/30 opacity-50" : ""
      } ${isToday ? "border-primary" : "border-border"}`}
    >
      <div
        className={`mb-1 text-right text-xs font-medium ${
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
          />
        ))}
      </div>
    </div>
  );
}
