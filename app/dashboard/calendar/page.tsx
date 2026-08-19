import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSessionsForRange } from "@/lib/domain/classes/actions";
import { parseDateOnly, formatDateOnly } from "@/lib/date";
import { listDisciplines } from "@/lib/domain/disciplines/actions";
import { listBranchTeacherOptions } from "@/lib/domain/roles/actions";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { ScheduledClassCreateDialog } from "@/components/classes/scheduled-class-create-dialog";
import { OneTimeClassCreateDialog } from "@/components/classes/one-time-class-create-dialog";
import { BranchSelector } from "@/components/branch/branch-selector";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";
import { redirect } from "next/navigation";

interface CalendarPageProps {
  searchParams: Promise<{
    branch?: string;
    disciplines?: string;
    view?: string;
    date?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(params.branch);

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{CALENDAR_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {CALENDAR_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams(params as Record<string, string>);
    redirectParams.set("branch", branchResult.branchId);
    redirect(`/dashboard/calendar?${redirectParams.toString()}`);
  }

  if (branchResult.type === "selector") {
    const { branch: _, ...otherParams } = params;
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/calendar"
        currentParams={otherParams as Record<string, string>}
      />
    );
  }

  const branchId = branchResult.branchId;
  const canManage = branchResult.canManage;
  const view = params.view === "week" ? "week" : "month";
  const today = new Date();
  const baseDate = params.date ? parseDateOnly(params.date) : today;

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

  const startStr = formatDateOnly(startDate);
  const endStr = formatDateOnly(endDate);
  const baseDateString = formatDateOnly(baseDate);

  // Parse discipline filter
  const disciplineIds = params.disciplines
    ? params.disciplines.split(",").filter(Boolean)
    : undefined;

  const [sessionsResult, disciplinesResult, teachersResult] = await Promise.all([
    getSessionsForRange({
      branch_id: branchId,
      start_date: startStr,
      end_date: endStr,
      discipline_ids: disciplineIds,
    }),
    canManage ? listDisciplines() : Promise.resolve({ success: true, data: [] }),
    canManage
      ? listBranchTeacherOptions({ branchId })
      : Promise.resolve({ success: true, data: [] }),
  ]);

  const sessions = sessionsResult.success ? (sessionsResult.data ?? []) : [];
  const disciplines = disciplinesResult.success ? (disciplinesResult.data ?? []) : [];
  const teachers = teachersResult.success ? (teachersResult.data ?? []) : [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{CALENDAR_MESSAGES.PAGE_TITLE}</h1>
        {canManage && (
          <div className="flex gap-2">
            <OneTimeClassCreateDialog
              branchId={branchId}
              disciplines={disciplines}
              teachers={teachers}
            />
            <ScheduledClassCreateDialog
              branchId={branchId}
              disciplines={disciplines}
              teachers={teachers}
            />
          </div>
        )}
      </div>
      {!sessionsResult.success && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{CALENDAR_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>{CALENDAR_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      )}
      <CalendarHeader currentView={view} baseDate={baseDateString} />
      {view === "month" ? (
        <CalendarMonthView sessions={sessions} baseDate={baseDateString} />
      ) : (
        <CalendarWeekView
          sessions={sessions}
          baseDate={startStr}
          teachers={teachers}
          canManage={canManage}
          branchId={branchId}
        />
      )}
    </div>
  );
}
