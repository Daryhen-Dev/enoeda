import { AlertCircleIcon, AwardIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BranchLevelRequirementsList } from "@/components/belts/branch-level-requirements-list";
import { APP_ROLES } from "@/lib/auth/authorize";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { listBranchLevelRequirements } from "@/lib/domain/levels/actions";
import { BRANCH_LEVEL_MESSAGES } from "@/lib/localization/es-ec";

interface BeltsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>;
}

/**
 * Cinturones section — branch-scoped belt promotion requirements.
 * Gating: teacher-only users are redirected to the calendar (same as the
 * schedule page); the management UI renders only for callers with an active
 * admin assignment on the resolved branch (branchResult.canManage), and
 * every underlying action re-asserts the assignment server-side.
 */
export default async function BeltsPage({ searchParams }: BeltsPageProps) {
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
      queryString ? `/dashboard/calendar?${queryString}` : "/dashboard/calendar"
    );
  }

  const branchResult = await resolveBranchContext(params.branch);

  if (branchResult.type === "error") {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{BRANCH_LEVEL_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {BRANCH_LEVEL_MESSAGES.NO_BRANCH_CONTEXT}
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
    redirect(`/dashboard/belts?${redirectParams.toString()}`);
  }

  const branchId = branchResult.branchId;

  if (!branchResult.canManage) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{BRANCH_LEVEL_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {BRANCH_LEVEL_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const requirementsResult = await listBranchLevelRequirements({
    branch_id: branchId,
  });
  const disciplines = requirementsResult.success
    ? requirementsResult.data ?? []
    : [];

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <AwardIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {BRANCH_LEVEL_MESSAGES.PAGE_TITLE}
          </h2>
          <p className="text-sm text-muted-foreground">
            {BRANCH_LEVEL_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
      </div>

      {!requirementsResult.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{BRANCH_LEVEL_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {BRANCH_LEVEL_MESSAGES.LOAD_FAILURE}
          </AlertDescription>
        </Alert>
      ) : (
        <BranchLevelRequirementsList
          branchId={branchId}
          disciplines={disciplines}
        />
      )}
    </div>
  );
}
