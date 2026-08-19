"use client";

import type { SessionView } from "@/lib/domain/classes/actions";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { CalendarDayCell } from "./calendar-day-cell";

interface CalendarMonthViewProps {
  sessions: SessionView[];
  baseDate: string;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarMonthView({ sessions, baseDate }: CalendarMonthViewProps) {
  const base = parseDateOnly(baseDate);
  const year = base.getFullYear();
  const month = base.getMonth();

  // Compute grid start (Monday of first visible week)
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay();
  const startOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() + startOffset);

  // Compute grid end (Sunday of last visible week)
  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastOfMonth.getDay();
  const endOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + endOffset);

  // Build array of dates
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // Group sessions by date
  const sessionsByDate = new Map<string, SessionView[]>();
  for (const s of sessions) {
    const existing = sessionsByDate.get(s.session_date) ?? [];
    existing.push(s);
    sessionsByDate.set(s.session_date, existing);
  }

  const today = formatDateOnly(new Date());

  return (
    <div className="flex flex-col gap-0.5">
      {/* Header row */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const dateStr = formatDateOnly(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = dateStr === today;
          const daySessions = sessionsByDate.get(dateStr) ?? [];

          return (
            <CalendarDayCell
              key={dateStr}
              date={dateStr}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              sessions={daySessions}
            />
          );
        })}
      </div>
    </div>
  );
}
