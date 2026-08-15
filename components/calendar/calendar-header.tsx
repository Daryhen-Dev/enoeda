"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";

interface CalendarHeaderProps {
  currentView: "month" | "week";
  baseDate: string;
}

export function CalendarHeader({ currentView, baseDate }: CalendarHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(direction: "prev" | "next" | "today") {
    const params = new URLSearchParams(searchParams.toString());
    const current = new Date(baseDate);

    if (direction === "today") {
      params.delete("date");
    } else {
      const offset = direction === "prev" ? -1 : 1;
      if (currentView === "month") {
        current.setMonth(current.getMonth() + offset);
      } else {
        current.setDate(current.getDate() + offset * 7);
      }
      params.set("date", current.toISOString().split("T")[0]);
    }

    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  function toggleView() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", currentView === "month" ? "week" : "month");
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  const displayDate = new Date(baseDate);
  const monthYear = displayDate.toLocaleDateString("es-EC", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("prev")}
          aria-label={CALENDAR_MESSAGES.PREV}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("next")}
          aria-label={CALENDAR_MESSAGES.NEXT}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("today")}>
          {CALENDAR_MESSAGES.TODAY}
        </Button>
        <span className="text-lg font-medium capitalize">{monthYear}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={currentView === "month" ? "default" : "outline"}
          size="sm"
          onClick={currentView === "month" ? undefined : toggleView}
        >
          {CALENDAR_MESSAGES.MONTH_VIEW}
        </Button>
        <Button
          variant={currentView === "week" ? "default" : "outline"}
          size="sm"
          onClick={currentView === "week" ? undefined : toggleView}
        >
          {CALENDAR_MESSAGES.WEEK_VIEW}
        </Button>
      </div>
    </div>
  );
}
