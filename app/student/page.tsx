import { redirect } from "next/navigation";

import { StudentPhoneForm } from "@/components/student-enrollment/student-phone-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  STUDENT_ACTIVATION_STATUS,
  STUDENT_IDENTITY_REASONS,
  getStudentIdentity,
} from "@/lib/auth/student-identity-resolver";
import {
  CONDUCT_MESSAGES,
  formatCurrency,
  formatDate,
  formatDateOnlyValue,
  PRODUCT_TERMS,
  PUBLIC_STUDENT_REGISTRATION_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  getOwnConductRecords,
  CONDUCT_KINDS,
  CONDUCT_STATUSES,
} from "@/lib/domain/conduct";
import type { ConductRecord, ConductSummary } from "@/lib/domain/conduct";

function formatStudentDate(value: string): string {
  return formatDate(new Date(`${value}T00:00:00`));
}

const EMPTY_CONDUCT_SUMMARY: ConductSummary = {
  pending_fines_count: 0,
  pending_fines_total: 0,
  warnings_count: 0,
};

function conductKindLabel(kind: string): string {
  return kind === CONDUCT_KINDS.FINE
    ? CONDUCT_MESSAGES.KIND_FINE
    : CONDUCT_MESSAGES.KIND_WARNING;
}

function conductSummaryLines(summary: ConductSummary): string[] {
  const lines: string[] = [];
  if (summary.pending_fines_count > 0) {
    lines.push(
      CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(
        summary.pending_fines_count,
        formatCurrency(summary.pending_fines_total)
      )
    );
  }
  if (summary.warnings_count > 0) {
    lines.push(CONDUCT_MESSAGES.SUMMARY_WARNINGS(summary.warnings_count));
  }
  return lines;
}

function ConductRecordItem({ record }: { record: ConductRecord }) {
  const isFine = record.kind === CONDUCT_KINDS.FINE;
  const isPaidFine =
    isFine &&
    record.status === CONDUCT_STATUSES.PAID &&
    record.paid_at !== null;

  return (
    <li className="rounded-md border p-3">
      <p className="text-sm font-medium">{record.reason}</p>
      <div className="flex flex-wrap gap-x-2 pt-1 text-xs text-muted-foreground">
        <span>{conductKindLabel(record.kind)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {CONDUCT_MESSAGES.INCIDENT_DATE_LABEL}: {formatDateOnlyValue(record.incident_date)}
        </span>
        {isFine && record.amount !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {CONDUCT_MESSAGES.AMOUNT_LABEL}: {formatCurrency(record.amount)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isPaidFine
                ? `${CONDUCT_MESSAGES.STATUS_PAID} (${CONDUCT_MESSAGES.PAID_AT_LABEL}: ${formatDate(record.paid_at!)})`
                : CONDUCT_MESSAGES.STATUS_PENDING}
            </span>
          </>
        ) : null}
      </div>
    </li>
  );
}

export default async function StudentProfilePage() {
  const identity = await getStudentIdentity();
  if (!identity.ok) {
    redirect(
      identity.reason === STUDENT_IDENTITY_REASONS.UNAUTHENTICATED
        ? "/login"
        : "/registro"
    );
  }

  const { student } = identity;

  const conductResult = await getOwnConductRecords();
  const conductData =
    conductResult.success && conductResult.data
      ? conductResult.data
      : { records: [] as ConductRecord[], summary: EMPTY_CONDUCT_SUMMARY };

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

      {student.activationStatus === STUDENT_ACTIVATION_STATUS.PENDING ? (
        <Alert>
          <AlertTitle>{PUBLIC_STUDENT_REGISTRATION_MESSAGES.PENDING_TITLE}</AlertTitle>
          <AlertDescription>
            {PUBLIC_STUDENT_REGISTRATION_MESSAGES.PENDING_DESCRIPTION}
          </AlertDescription>
        </Alert>
      ) : null}

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
            <dd className="font-medium">
              {student.nationalId ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.DATE_OF_BIRTH_LABEL}</dt>
            <dd className="font-medium">
              {student.dateOfBirth === null
                ? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED
                : formatStudentDate(student.dateOfBirth)}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">{STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL}</dt>
            <dd className="font-medium">
              {student.email ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
            </dd>
          </div>
        </dl>
      </section>

      <StudentPhoneForm isActive={student.isActive} phone={student.phone} />

      <section
        aria-label={CONDUCT_MESSAGES.PANEL_TITLE}
        className="border-y py-5"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {CONDUCT_MESSAGES.PANEL_TITLE}
          </h2>
          {conductSummaryLines(conductData.summary).map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
        {conductData.records.length === 0 ? (
          <p className="pt-3 text-sm text-muted-foreground">
            {CONDUCT_MESSAGES.EMPTY_STATE}
          </p>
        ) : (
          <ul className="flex flex-col gap-3 pt-3">
            {conductData.records.map((record) => (
              <ConductRecordItem key={record.id} record={record} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
