"use client";

import type { SessionView } from "@/lib/domain/classes/actions";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";
import { SessionBlock } from "./session-block";

interface CalendarWeekViewProps {
  sessions: SessionView[];
  baseDate: string;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export function CalendarWeekView({
  sessions,
  baseDate,
  teachers = [],
  canManage = false,
  branchId,
}: CalendarWeekViewProps) {
  const start = parseDateOnly(baseDate);
  const days: Date[] = [];
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(day);
  }

  const today = formatDateOnly(new Date());
  const sessionsByDate = new Map<string, SessionView[]>();
  for (const session of sessions) {
    const existing = sessionsByDate.get(session.session_date) ?? [];
    existing.push(session);
    sessionsByDate.set(session.session_date, existing);
  }

  function renderSessions(date: string) {
    const daySessions = [...(sessionsByDate.get(date) ?? [])].sort((first, second) =>
      first.start_time.localeCompare(second.start_time)
    );

    if (daySessions.length === 0) {
      return <p className="text-sm text-muted-foreground">{CALENDAR_MESSAGES.DAY_EMPTY_STATE}</p>;
    }

    return daySessions.map((session) => (
      <SessionBlock
        key={`${session.scheduled_class_id}-${session.session_date}`}
        session={session}
        teachers={teachers}
        canManage={canManage}
        branchId={branchId}
      />
    ));
  }

  return (
    <>
      <div className="flex flex-col gap-4 lg:hidden">
        {days.map((day, index) => {
          const date = formatDateOnly(day);
          const isToday = date === today;
          const dayLabel = day.toLocaleDateString("es-EC", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });

          return (
            <section key={date} className="flex flex-col gap-3 border-b pb-4 last:border-b-0">
              <h2
                className={`rounded-md px-3 py-2 text-base font-medium capitalize ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
                aria-current={isToday ? "date" : undefined}
              >
                <span className="sr-only">{WEEKDAY_LABELS[index]}: </span>
                {dayLabel}
              </h2>
              <div className="flex flex-col gap-3">{renderSessions(date)}</div>
            </section>
          );
        })}
      </div>

      <div className="hidden grid-cols-7 gap-2 lg:grid">
        {days.map((day, index) => {
          const date = formatDateOnly(day);
          const isToday = date === today;
          return (
            <div key={date} className="flex min-w-0 flex-col gap-1">
              <div
                className={`rounded-md py-2 text-center text-base font-medium ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
                aria-current={isToday ? "date" : undefined}
              >
                <div>{WEEKDAY_LABELS[index]}</div>
                <div className="text-xl">{day.getDate()}</div>
              </div>
              <div className="flex flex-col gap-1">{renderSessions(date)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
