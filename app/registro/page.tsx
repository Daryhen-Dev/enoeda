import { PublicStudentRegistrationForm } from "@/components/student-registration/public-student-registration-form";
import { listPublicActiveBranches } from "@/lib/domain/student-registration";
import { PUBLIC_STUDENT_REGISTRATION_MESSAGES } from "@/lib/localization/es-ec";

export default async function PublicStudentRegistrationPage() {
  const branches = await listPublicActiveBranches();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {PUBLIC_STUDENT_REGISTRATION_MESSAGES.TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {PUBLIC_STUDENT_REGISTRATION_MESSAGES.DESCRIPTION}
          </p>
        </div>
        <PublicStudentRegistrationForm branches={branches} />
      </section>
    </main>
  );
}
