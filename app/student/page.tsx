import { redirect } from "next/navigation";

import { StudentPhoneForm } from "@/components/student-enrollment/student-phone-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  STUDENT_IDENTITY_REASONS,
  getStudentIdentity,
} from "@/lib/auth/student-identity-resolver";
import { PRODUCT_TERMS, STUDENT_ENROLLMENT_MESSAGES, formatDate } from "@/lib/localization/es-ec";

function formatStudentDate(value: string): string {
  return formatDate(new Date(`${value}T00:00:00`));
}

export default async function StudentProfilePage() {
  const identity = await getStudentIdentity();
  if (!identity.ok) {
    redirect(
      identity.reason === STUDENT_IDENTITY_REASONS.UNAUTHENTICATED
        ? "/login"
        : "/enroll"
    );
  }

  const { student } = identity;

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {STUDENT_ENROLLMENT_MESSAGES.PROFILE_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {STUDENT_ENROLLMENT_MESSAGES.STUDENT_AREA_DESCRIPTION}
        </p>
      </div>

      {!student.isActive ? (
        <Alert>
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.PROFILE_TITLE}</AlertTitle>
          <AlertDescription>
            {STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label={STUDENT_ENROLLMENT_MESSAGES.PROFILE_TITLE} className="border-y py-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.FIRST_NAME_LABEL}</dt>
            <dd className="font-medium">{student.firstName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.SURNAME_LABEL}</dt>
            <dd className="font-medium">{student.surname}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{PRODUCT_TERMS.NATIONAL_ID}</dt>
            <dd className="font-medium">{student.nationalId}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.DATE_OF_BIRTH_LABEL}</dt>
            <dd className="font-medium">{formatStudentDate(student.dateOfBirth)}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL}</dt>
            <dd className="font-medium">{student.email}</dd>
          </div>
        </dl>
      </section>

      <StudentPhoneForm isActive={student.isActive} phone={student.phone} />
    </>
  );
}
