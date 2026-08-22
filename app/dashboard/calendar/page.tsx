import { AlertCircleIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSessionsForRange } from "@/lib/domain/classes/actions";
import { parseDateOnly, formatDateOnly } from "@/lib/date";
import { listDisciplines } from "@/lib/domain/disciplines/actions";
import { getBranchDefaultTeacher, listBranchTeacherOptions } from "@/lib/domain/roles/actions";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarDayView } from "@/components/calendar/calendar-day-view";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { ScheduledClassCreateDialog } from "@/components/classes/scheduled-class-create-dialog";
import { OneTimeClassCreateDialog } from "@/components/classes/one-time-class-create-dialog";
import { BranchSelector } from "@/components/branch/branch-selector";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { CALENDAR_MESSAGES } from "@/lib/localization/es-ec";

const CALENDAR_VIEWS = { DAY: "day", WEEK: "week", MONTH: "month" } as const;
type CalendarView = (typeof CALENDAR_VIEWS)[keyof typeof CALENDAR_VIEWS];
interface CalendarSearchParams { branch?: string; disciplines?: string; view?: string; date?: string; [key: string]: string | undefined; }
interface CalendarPageProps { searchParams: Promise<CalendarSearchParams>; }

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const branchResult = await resolveBranchContext(params.branch, { allowGlobalAdminRead: true });
  if (branchResult.type === "error") return <div className="flex flex-1 flex-col gap-4 p-4"><Alert variant="destructive"><AlertCircleIcon /><AlertTitle>{CALENDAR_MESSAGES.PAGE_TITLE}</AlertTitle><AlertDescription>{CALENDAR_MESSAGES.NO_BRANCH_CONTEXT}</AlertDescription></Alert></div>;
  if (branchResult.type === "redirect") { const redirectParams = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (typeof value === "string") redirectParams.set(key, value); redirectParams.set("branch", branchResult.branchId); redirect(`/dashboard/calendar?${redirectParams.toString()}`); }
  if (branchResult.type === "selector") { const currentParams = Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => entry[0] !== "branch" && typeof entry[1] === "string")); return <BranchSelector branches={branchResult.branches} currentPath="/dashboard/calendar" currentParams={currentParams} />; }
  const view: CalendarView = params.view === CALENDAR_VIEWS.DAY ? CALENDAR_VIEWS.DAY : params.view === CALENDAR_VIEWS.WEEK ? CALENDAR_VIEWS.WEEK : CALENDAR_VIEWS.MONTH;
  const baseDate = params.date ? parseDateOnly(params.date) : new Date();
  let startDate: Date; let endDate: Date;
  if (view === CALENDAR_VIEWS.DAY) { startDate = new Date(baseDate); endDate = new Date(baseDate); }
  else if (view === CALENDAR_VIEWS.WEEK) { const diff = baseDate.getDay() === 0 ? -6 : 1 - baseDate.getDay(); startDate = new Date(baseDate); startDate.setDate(baseDate.getDate() + diff); endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); }
  else { startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1); startDate.setDate(startDate.getDate() + (startDate.getDay() === 0 ? -6 : 1 - startDate.getDay())); endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0); endDate.setDate(endDate.getDate() + (endDate.getDay() === 0 ? 0 : 7 - endDate.getDay())); }
  const branchId = branchResult.branchId;
  const canManage = branchResult.canManage;
  const startStr = formatDateOnly(startDate); const endStr = formatDateOnly(endDate); const baseDateString = formatDateOnly(baseDate);
  const disciplineIds = params.disciplines ? params.disciplines.split(",").filter(Boolean) : undefined;
  const [sessionsResult, disciplinesResult, teachersResult, defaultTeacherId] = await Promise.all([
    getSessionsForRange({ branch_id: branchId, start_date: startStr, end_date: endStr, discipline_ids: disciplineIds, allow_global_admin_read: branchResult.isGlobalAdminReadOnly === true }),
    canManage ? listDisciplines() : Promise.resolve({ success: true, data: [] }),
    canManage ? listBranchTeacherOptions({ branchId }) : Promise.resolve({ success: true, data: [] }),
    canManage ? getBranchDefaultTeacher(branchId) : Promise.resolve(null),
  ]);
  const sessions = sessionsResult.success ? sessionsResult.data ?? [] : []; const disciplines = disciplinesResult.success ? disciplinesResult.data ?? [] : []; const teachers = teachersResult.success ? teachersResult.data ?? [] : [];
  const calendar = view === CALENDAR_VIEWS.DAY ? <CalendarDayView sessions={sessions} baseDate={baseDateString} teachers={teachers} canManage={canManage} branchId={branchId} /> : view === CALENDAR_VIEWS.WEEK ? <CalendarWeekView sessions={sessions} baseDate={startStr} teachers={teachers} canManage={canManage} branchId={branchId} /> : <CalendarMonthView sessions={sessions} baseDate={baseDateString} teachers={teachers} canManage={canManage} branchId={branchId} />;
  return <div className="flex flex-1 flex-col gap-4 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-2xl font-semibold">{CALENDAR_MESSAGES.PAGE_TITLE}</h1>{canManage && <div className="flex flex-wrap gap-2"><OneTimeClassCreateDialog branchId={branchId} disciplines={disciplines} teachers={teachers} defaultTeacherId={defaultTeacherId} /><ScheduledClassCreateDialog branchId={branchId} disciplines={disciplines} teachers={teachers} /></div>}</div>{!sessionsResult.success && <Alert variant="destructive"><AlertCircleIcon /><AlertTitle>{CALENDAR_MESSAGES.PAGE_TITLE}</AlertTitle><AlertDescription>{CALENDAR_MESSAGES.LOAD_FAILURE}</AlertDescription></Alert>}<CalendarHeader currentView={view} baseDate={baseDateString} />{calendar}</div>;
}
