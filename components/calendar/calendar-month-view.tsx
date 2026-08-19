"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { formatDateOnly, parseDateOnly } from "@/lib/date";
import type { SessionView } from "@/lib/domain/classes/actions";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";
import { CalendarDayCell } from "./calendar-day-cell";
import { SessionBlock } from "./session-block";

interface CalendarMonthViewProps {
  sessions: SessionView[];
  baseDate: string;
  teachers?: Array<{ id: string; name: string }>;
  canManage?: boolean;
  branchId?: string;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export function CalendarMonthView({
  sessions,
  baseDate,
  teachers = [],
  canManage = false,
  branchId,
}: CalendarMonthViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = baseDate;
  const base = parseDateOnly(baseDate);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay();
  const startOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() + startOffset);

  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastOfMonth.getDay();
  const endOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + endOffset);

  const days: Date[] = [];
  for (let day = new Date(gridStart); day <= gridEnd; day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }

  const sessionsByDate = new Map<string, SessionView[]>();
  for (const session of sessions) {
    const existing = sessionsByDate.get(session.session_date) ?? [];
    existing.push(session);
    sessionsByDate.set(session.session_date, existing);
  }

  const today = formatDateOnly(new Date());
  const selectedSessions = [...(sessionsByDate.get(selectedDate) ?? [])].sort(
    (first, second) => first.start_time.localeCompare(second.start_time)
  );
  const selectedDateLabel = parseDateOnly(selectedDate).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function selectDate(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden flex-col gap-0.5 md:flex">
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const date = formatDateOnly(day);
            return (
              <CalendarDayCell
                key={date}
                date={date}
                isCurrentMonth={day.getMonth() === month}
                isToday={date === today}
                sessions={sessionsByDate.get(date) ?? []}
                teachers={teachers}
                canManage={canManage}
                branchId={branchId}
              />
            );
          })}
        </div>
      </div>

      <section className="flex flex-col gap-4 md:hidden" aria-labelledby="month-date-selector-title">
        <h2 id="month-date-selector-title" className="sr-only">
          {CALENDAR_MESSAGES.MONTH_DATE_SELECTOR_LABEL}
        </h2>
        <div className="grid grid-cols-7 gap-1" aria-label={CALENDAR_MESSAGES.MONTH_DATE_SELECTOR_LABEL}>
          {days.map((day) => {
            const date = formatDateOnly(day);
            const daySessions = sessionsByDate.get(date) ?? [];
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const isCurrentMonth = day.getMonth() === month;
            const hasSuspended = daySessions.some((session) => session.status === "suspended");
            const hasCompleted = daySessions.some(
              (session) =>
                session.status !== "suspended" && session.attendance.record_count > 0
            );
            const hasScheduled = daySessions.some(
              (session) =>
                session.status !== "suspended" && session.attendance.record_count === 0
            );

            return (
              <button
                key={date}
                type="button"
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrentMonth
                      ? "border-border bg-background hover:bg-muted"
                      : "border-border bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => selectDate(date)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={CALENDAR_MESSAGES.DATE_SELECTOR_ARIA_LABEL(
                  day.toLocaleDateString("es-EC", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }),
                  daySessions.length,
                  isSelected
                )}
              >
                <span>{day.getDate()}</span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {hasScheduled && <span className="size-1 rounded-full bg-amber-500" />}
                  {hasCompleted && <span className="size-1 rounded-full bg-emerald-600" />}
                  {hasSuspended && <span className="size-1 rounded-full bg-destructive" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3" aria-live="polite">
          <h3 className="text-base font-semibold capitalize">{selectedDateLabel}</h3>
          {selectedSessions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {CALENDAR_MESSAGES.DAY_EMPTY_STATE}
            </p>
          ) : (
            selectedSessions.map((session) => (
              <SessionBlock
                key={`${session.scheduled_class_id}-${session.session_date}`}
                session={session}
                teachers={teachers}
                canManage={canManage}
                branchId={branchId}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
