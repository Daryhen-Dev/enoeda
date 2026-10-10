import { AlertCircleIcon, CalendarRangeIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SeriesList } from "@/components/schedule/series-list";
import { APP_ROLES } from "@/lib/auth/authorize";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { listClassSeries, listUpcomingOneTimeClasses } from "@/lib/domain/classes/actions";
import { listDisciplines } from "@/lib/domain/disciplines/actions";
import { getBranchDefaultTeacher, listBranchTeacherOptions } from "@/lib/domain/roles/actions";
import { SCHEDULE_SERIES_MESSAGES } from "@/lib/localization/es-ec";

interface SchedulePageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>;
}

/**
 * Class-schedules section — admin-scoped recurring-series management.
 * Gating: teacher-only users are redirected to the calendar (same as the
 * staff page); the management UI renders only for callers with an active
 * admin assignment on the resolved branch (branchResult.canManage), and
 * every underlying action re-asserts the assignment server-side.
 */
export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = await searchParams;
  const identityResult = await getAuthenticatedContext();
  const isTeacherOnly =
    identityResult.ok &&
    identityResult.ctx.roles.includes(APP_ROLES.TEACHER) &&
    !identityResult.ctx.roles.includes(APP_ROLES.ADMIN);

  if (isTeacherOnly) {
    const redirectParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) redirectParams.append(key, value);
    }
    const queryString = redirectParams.toString();
    redirect(
      queryString
        ? `/dashboard/calendar?${queryString}`
        : "/dashboard/calendar"
    );
  }

  const branchResult = await resolveBranchContext(params.branch);

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{SCHEDULE_SERIES_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {SCHEDULE_SERIES_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value);
    }
    redirectParams.set("branch", branchResult.branchId);
    redirect(`/dashboard/schedule?${redirectParams.toString()}`);
  }

  const branchId = branchResult.branchId;

  if (!branchResult.canManage) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{SCHEDULE_SERIES_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {SCHEDULE_SERIES_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [seriesResult, disciplinesResult, teachersResult, oneTimeClassesResult, defaultTeacherId] = await Promise.all([
    listClassSeries({ branch_id: branchId }),
    listDisciplines(),
    listBranchTeacherOptions({ branchId }),
    listUpcomingOneTimeClasses({ branch_id: branchId }),
    getBranchDefaultTeacher(branchId),
  ]);

  const series = seriesResult.success ? seriesResult.data ?? [] : [];
  const oneTimeClasses = oneTimeClassesResult.success ? oneTimeClassesResult.data ?? [] : [];
  const disciplines = disciplinesResult.success ? disciplinesResult.data ?? [] : [];
  const teachers = teachersResult.success ? teachersResult.data ?? [] : [];

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <CalendarRangeIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {SCHEDULE_SERIES_MESSAGES.PAGE_TITLE}
          </h2>
          <p className="text-sm text-muted-foreground">
            {SCHEDULE_SERIES_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
      </div>

      {!seriesResult.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{SCHEDULE_SERIES_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {SCHEDULE_SERIES_MESSAGES.LOAD_FAILURE}
          </AlertDescription>
        </Alert>
      ) : (
        <SeriesList
          branchId={branchId}
          series={series}
          disciplines={disciplines.map((discipline) => ({
            id: discipline.id,
            name: discipline.name,
          }))}
          teachers={teachers.map((teacher) => ({
            id: teacher.id,
            name: teacher.name,
          }))}
          defaultTeacherId={defaultTeacherId}
          oneTimeClasses={oneTimeClasses}
        />
      )}
    </div>
  );
}
