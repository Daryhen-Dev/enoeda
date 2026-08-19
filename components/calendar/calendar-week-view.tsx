"use client";

import type { SessionView } from "@/lib/domain/classes/actions";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { SessionBlock } from "./session-block";

interface CalendarWeekViewProps {
  sessions: SessionView[];
  baseDate: string;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarWeekView({
  sessions,
  baseDate,
  teachers = [],
  canManage = false,
  branchId,
}: CalendarWeekViewProps) {
  // baseDate is the Monday of the week
  const start = parseDateOnly(baseDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const today = formatDateOnly(new Date());

  // Group sessions by date
  const sessionsByDate = new Map<string, SessionView[]>();
  for (const s of sessions) {
    const existing = sessionsByDate.get(s.session_date) ?? [];
    existing.push(s);
    sessionsByDate.set(s.session_date, existing);
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, idx) => {
        const dateStr = formatDateOnly(day);
        const isToday = dateStr === today;
        const daySessions = (sessionsByDate.get(dateStr) ?? []).sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );

        return (
          <div key={dateStr} className="flex flex-col gap-1">
            <div
              className={`rounded-md py-2 text-center text-base font-medium ${
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              <div>{WEEKDAY_LABELS[idx]}</div>
              <div className="text-xl">{day.getDate()}</div>
            </div>
            <div className="flex flex-col gap-1">
              {daySessions.map((session) => (
                <SessionBlock
                  key={`${session.scheduled_class_id}-${session.session_date}`}
                  session={session}
                  teachers={teachers}
                  canManage={canManage}
                  branchId={branchId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
