"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef, TableFeatures } from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createStudentInvitation,
  resendStudentInvitation,
  revokeStudentInvitation,
  STUDENT_INVITATION_STATES,
  type StudentInvitationListItem,
  type StudentInvitationState,
} from "@/lib/domain/student-enrollment";
import {
  COMMON_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
  TOAST_MESSAGES,
  formatDateTime,
} from "@/lib/localization/es-ec";

interface InvitationManagementProps {
  branchId: string;
  branchName: string;
  invitations: StudentInvitationListItem[];
}

const invitationStateLabels: Record<StudentInvitationState, string> = {
  [STUDENT_INVITATION_STATES.ACCEPTED]: STUDENT_ENROLLMENT_MESSAGES.STATE_ACCEPTED,
  [STUDENT_INVITATION_STATES.EXPIRED]: STUDENT_ENROLLMENT_MESSAGES.STATE_EXPIRED,
  [STUDENT_INVITATION_STATES.NEEDS_REVIEW]: STUDENT_ENROLLMENT_MESSAGES.STATE_NEEDS_REVIEW,
  [STUDENT_INVITATION_STATES.PENDING]: STUDENT_ENROLLMENT_MESSAGES.STATE_PENDING,
  [STUDENT_INVITATION_STATES.REVOKED]: STUDENT_ENROLLMENT_MESSAGES.STATE_REVOKED,
};

function isActionableInvitation(state: StudentInvitationState): boolean {
  return state !== STUDENT_INVITATION_STATES.ACCEPTED;
}

function formatInvitationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatDateTime(date);
}

export function InvitationManagement({
  branchId,
  branchName,
  invitations,
}: InvitationManagementProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refreshAfterSuccess(message: string) {
    setActionError(null);
    toast.success(message);
    router.refresh();
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createStudentInvitation({ branch_id: branchId, email });
      if (!result.success) {
        setActionError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
        return;
      }

      setEmail("");
      refreshAfterSuccess(TOAST_MESSAGES.STUDENT_INVITATION_SENT);
    });
  }

  function handleResend(invitation: StudentInvitationListItem) {
    startTransition(async () => {
      const result = await resendStudentInvitation({ id: invitation.id });
      if (!result.success) {
        setActionError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
        if (result.error === STUDENT_ENROLLMENT_MESSAGES.INVITATION_REQUIRES_REVIEW) {
          router.refresh();
        }
        return;
      }

      refreshAfterSuccess(TOAST_MESSAGES.STUDENT_INVITATION_RESENT);
    });
  }

  function handleRevoke(invitation: StudentInvitationListItem) {
    startTransition(async () => {
      const result = await revokeStudentInvitation({ id: invitation.id });
      if (!result.success) {
        setActionError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
        return;
      }

      refreshAfterSuccess(TOAST_MESSAGES.STUDENT_INVITATION_REVOKED);
    });
  }

  const columns: ColumnDef<TableFeatures, StudentInvitationListItem>[] = [
    {
      id: "email",
      header: STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL,
      cell: ({ row }) => row.original.email,
    },
    {
      id: "state",
      header: STUDENT_ENROLLMENT_MESSAGES.STATUS_LABEL,
      cell: ({ row }) => (
        <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
          {invitationStateLabels[row.original.state]}
        </span>
      ),
    },
    {
      id: "expiresAt",
      header: STUDENT_ENROLLMENT_MESSAGES.EXPIRES_AT,
      cell: ({ row }) => formatInvitationDate(row.original.expiresAt),
    },
    {
      id: "actions",
      header: COMMON_MESSAGES.EDIT,
      cell: ({ row }) =>
        isActionableInvitation(row.original.state) ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => handleResend(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              {STUDENT_ENROLLMENT_MESSAGES.RESEND_ACTION}
            </Button>
            {row.original.state !== STUDENT_INVITATION_STATES.REVOKED ? (
              <Button
                disabled={isPending}
                onClick={() => handleRevoke(row.original)}
                size="sm"
                type="button"
                variant="destructive"
              >
                {STUDENT_ENROLLMENT_MESSAGES.REVOKE_ACTION}
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <section aria-labelledby="student-invitations-heading" className="flex max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <h1 id="student-invitations-heading" className="text-2xl font-semibold tracking-tight">
          {STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_DESCRIPTION} {branchName}
        </p>
      </div>

      <form className="rounded-lg border bg-card p-4" onSubmit={handleCreate}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="student-invitation-email">
              {STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL}
            </FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                autoComplete="email"
                disabled={isPending}
                id="student-invitation-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <Button disabled={isPending} type="submit">
                {isPending
                  ? STUDENT_ENROLLMENT_MESSAGES.UPDATING
                  : STUDENT_ENROLLMENT_MESSAGES.CREATE_ACTION}
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </form>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TITLE}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        caption={STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_TABLE_CAPTION}
        columns={columns}
        data={invitations}
        emptyState={STUDENT_ENROLLMENT_MESSAGES.INVITATIONS_EMPTY}
      />
    </section>
  );
}
