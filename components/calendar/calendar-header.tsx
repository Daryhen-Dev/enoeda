"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";

const CALENDAR_VIEWS = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
} as const;

type CalendarView = (typeof CALENDAR_VIEWS)[keyof typeof CALENDAR_VIEWS];

const NAVIGATION_DIRECTIONS = {
  PREVIOUS: "previous",
  NEXT: "next",
  TODAY: "today",
} as const;

type NavigationDirection =
  (typeof NAVIGATION_DIRECTIONS)[keyof typeof NAVIGATION_DIRECTIONS];

interface CalendarHeaderProps {
  currentView: CalendarView;
  baseDate: string;
}

export function CalendarHeader({ currentView, baseDate }: CalendarHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushCalendar(params: URLSearchParams) {
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  function navigate(direction: NavigationDirection) {
    const params = new URLSearchParams(searchParams.toString());
    const current = parseDateOnly(baseDate);

    if (direction === NAVIGATION_DIRECTIONS.TODAY) {
      params.delete("date");
      pushCalendar(params);
      return;
    }

    const offset = direction === NAVIGATION_DIRECTIONS.PREVIOUS ? -1 : 1;
    if (currentView === CALENDAR_VIEWS.MONTH) {
      current.setMonth(current.getMonth() + offset);
    } else if (currentView === CALENDAR_VIEWS.WEEK) {
      current.setDate(current.getDate() + offset * 7);
    } else {
      current.setDate(current.getDate() + offset);
    }

    params.set("date", formatDateOnly(current));
    pushCalendar(params);
  }

  function selectView(view: CalendarView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    pushCalendar(params);
  }

  const displayDate = parseDateOnly(baseDate);
  const periodLabel = displayDate.toLocaleDateString("es-EC", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-lg"
            className="min-h-11 min-w-11"
            onClick={() => navigate(NAVIGATION_DIRECTIONS.PREVIOUS)}
            aria-label={CALENDAR_MESSAGES.PREV}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="min-h-11 min-w-11"
            onClick={() => navigate(NAVIGATION_DIRECTIONS.NEXT)}
            aria-label={CALENDAR_MESSAGES.NEXT}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => navigate(NAVIGATION_DIRECTIONS.TODAY)}
        >
          {CALENDAR_MESSAGES.TODAY}
        </Button>
        <span className="min-w-0 text-base font-medium capitalize sm:text-lg">
          {periodLabel}
        </span>
      </div>
      <div className="grid w-full grid-cols-3 gap-1 sm:w-auto" aria-label={CALENDAR_MESSAGES.VIEW_SELECTOR_LABEL}>
        <Button
          variant={currentView === CALENDAR_VIEWS.DAY ? "default" : "outline"}
          className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
          onClick={() => selectView(CALENDAR_VIEWS.DAY)}
          aria-pressed={currentView === CALENDAR_VIEWS.DAY}
        >
          {CALENDAR_MESSAGES.DAY_VIEW}
        </Button>
        <Button
          variant={currentView === CALENDAR_VIEWS.WEEK ? "default" : "outline"}
          className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
          onClick={() => selectView(CALENDAR_VIEWS.WEEK)}
          aria-pressed={currentView === CALENDAR_VIEWS.WEEK}
        >
          {CALENDAR_MESSAGES.WEEK_VIEW}
        </Button>
        <Button
          variant={currentView === CALENDAR_VIEWS.MONTH ? "default" : "outline"}
          className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
          onClick={() => selectView(CALENDAR_VIEWS.MONTH)}
          aria-pressed={currentView === CALENDAR_VIEWS.MONTH}
        >
          {CALENDAR_MESSAGES.MONTH_VIEW}
        </Button>
      </div>
    </div>
  );
}
