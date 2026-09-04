import { redirect } from "next/navigation";

import { EnrollmentFlow } from "@/components/student-enrollment/enrollment-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  STUDENT_ENROLLMENT_CONTEXT_KINDS,
  getStudentEnrollmentContext,
} from "@/lib/auth/student-identity-resolver";
import { STUDENT_INVITATION_STATES } from "@/lib/domain/student-enrollment";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

function invitationMessage(state: string): string {
  if (state === STUDENT_INVITATION_STATES.EXPIRED) {
    return STUDENT_ENROLLMENT_MESSAGES.INVITATION_EXPIRED;
  }
  if (state === STUDENT_INVITATION_STATES.REVOKED) {
    return STUDENT_ENROLLMENT_MESSAGES.INVITATION_REVOKED;
  }
  if (state === STUDENT_INVITATION_STATES.NEEDS_REVIEW) {
    return STUDENT_ENROLLMENT_MESSAGES.NEEDS_REVIEW;
  }
  return STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE;
}

function EnrollmentUnavailable({ message }: { message: string }) {
  return (
    <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
      <Alert variant="destructive">
        <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_TITLE}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </section>
  );
}

export default async function EnrollmentPage() {
  const context = await getStudentEnrollmentContext();

  if (context.kind === STUDENT_ENROLLMENT_CONTEXT_KINDS.UNAUTHENTICATED) {
    redirect("/login");
  }
  if (context.kind === STUDENT_ENROLLMENT_CONTEXT_KINDS.STUDENT) {
    redirect("/student");
  }

  if (
    context.kind === STUDENT_ENROLLMENT_CONTEXT_KINDS.INVITATION &&
    context.invitation.state === STUDENT_INVITATION_STATES.PENDING
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
        <EnrollmentFlow
          email={context.invitation.email}
          passwordConfigured={context.invitation.passwordConfigured}
        />
      </main>
    );
  }

  const unavailableMessage =
    context.kind === STUDENT_ENROLLMENT_CONTEXT_KINDS.INVITATION
      ? invitationMessage(context.invitation.state)
      : STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <EnrollmentUnavailable message={unavailableMessage} />
    </main>
  );
}
