"use client";

import type { SessionView } from "@/lib/domain/classes/actions";
import { parseDateOnly } from "@/lib/date";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";
import { SessionBlock } from "./session-block";

interface CalendarDayViewProps {
  sessions: SessionView[];
  baseDate: string;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

export function CalendarDayView({
  sessions,
  baseDate,
  teachers = [],
  canManage = false,
  branchId,
}: CalendarDayViewProps) {
  const selectedDate = parseDateOnly(baseDate);
  const dateLabel = selectedDate.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const sortedSessions = [...sessions].sort((first, second) =>
    first.start_time.localeCompare(second.start_time)
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="calendar-day-title">
      <div className="flex flex-col gap-1">
        <h2 id="calendar-day-title" className="text-lg font-semibold capitalize">
          {dateLabel}
        </h2>
        <p className="text-sm text-muted-foreground">{CALENDAR_MESSAGES.DAY_AGENDA}</p>
      </div>
      {sortedSessions.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {CALENDAR_MESSAGES.DAY_EMPTY_STATE}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedSessions.map((session) => (
            <SessionBlock
              key={`${session.scheduled_class_id}-${session.session_date}`}
              session={session}
              teachers={teachers}
              canManage={canManage}
              branchId={branchId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
