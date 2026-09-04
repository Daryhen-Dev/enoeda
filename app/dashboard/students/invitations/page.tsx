import { redirect } from "next/navigation";

import { BranchSelector } from "@/components/branch/branch-selector";
import { InvitationManagement } from "@/components/student-invitations/invitation-management";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { listStudentInvitations } from "@/lib/domain/student-enrollment";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

interface InvitationsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>;
}

export default async function StudentInvitationsPage({
  searchParams,
}: InvitationsPageProps) {
  const params = await searchParams;
  const branchResult = await resolveBranchContext(params.branch);

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TITLE}</AlertTitle>
          <AlertDescription>{STUDENT_ENROLLMENT_MESSAGES.ADMIN_ONLY}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (branchResult.type === "redirect") {
    redirect(`/dashboard/students/invitations?branch=${branchResult.branchId}`);
  }

  if (branchResult.type === "selector") {
    const currentParams: Record<string, string> = Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string] =>
          entry[0] !== "branch" && entry[1] !== undefined
      )
    );
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentParams={currentParams}
        currentPath="/dashboard/students/invitations"
      />
    );
  }

  if (!branchResult.canManage) {
    return (
      <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TITLE}</AlertTitle>
          <AlertDescription>{STUDENT_ENROLLMENT_MESSAGES.ADMIN_ONLY}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const invitationsResult = await listStudentInvitations({
    branch_id: branchResult.branchId,
  });

  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      {invitationsResult.success && invitationsResult.data !== undefined ? (
        <InvitationManagement
          branchId={branchResult.branchId}
          branchName={branchResult.branchName}
          invitations={invitationsResult.data}
        />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TITLE}</AlertTitle>
          <AlertDescription>
            {invitationsResult.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_LOAD_FAILURE}
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}
