import { getSessionsForRange } from "@/lib/domain/classes/actions";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";

interface CalendarPageProps {
  searchParams: Promise<{
    disciplines?: string;
    view?: string;
    date?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";
  const today = new Date();
  const baseDate = params.date ? new Date(params.date) : today;

  // Compute date range based on view
  let startDate: Date;
  let endDate: Date;

  if (view === "week") {
    // Start on Monday of the current week
    const dayOfWeek = baseDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() + diff);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else {
    // Full month: start from the Monday of the first week showing
    startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const firstDayOfWeek = startDate.getDay();
    const startOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    startDate.setDate(startDate.getDate() + startOffset);

    endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    const lastDayOfWeek = endDate.getDay();
    const endOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    endDate.setDate(endDate.getDate() + endOffset);
  }

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Parse discipline filter
  const disciplineIds = params.disciplines
    ? params.disciplines.split(",").filter(Boolean)
    : undefined;

  // TODO: branch_id should come from user context; placeholder for now
  const branchId = "placeholder-branch-id";

  const result = await getSessionsForRange({
    branch_id: branchId,
    start_date: startStr,
    end_date: endStr,
    discipline_ids: disciplineIds,
  });

  const sessions = result.success ? (result.data ?? []) : [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{CALENDAR_MESSAGES.PAGE_TITLE}</h1>
      <CalendarHeader
        currentView={view}
        baseDate={baseDate.toISOString().split("T")[0]}
      />
      {view === "month" ? (
        <CalendarMonthView
          sessions={sessions}
          baseDate={baseDate.toISOString().split("T")[0]}
        />
      ) : (
        <CalendarWeekView
          sessions={sessions}
          baseDate={startStr}
        />
      )}
    </div>
  );
}
