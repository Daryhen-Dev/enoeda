export const STUDENT_INVITATION_STATES = {
  ACCEPTED: "accepted",
  EXPIRED: "expired",
  NEEDS_REVIEW: "needs_review",
  PENDING: "pending",
  REVOKED: "revoked",
} as const;

export type StudentInvitationState =
  (typeof STUDENT_INVITATION_STATES)[keyof typeof STUDENT_INVITATION_STATES];

export interface StudentInvitationListItem {
  branchId: string;
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  passwordConfigured: boolean;
  state: StudentInvitationState;
}

export interface StudentEnrollmentInvitation {
  email: string;
  passwordConfigured: boolean;
  state: StudentInvitationState;
}

export interface StudentEnrollmentActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function isStudentInvitationState(
  value: unknown
): value is StudentInvitationState {
  return (
    typeof value === "string" &&
    Object.values(STUDENT_INVITATION_STATES).some((state) => state === value)
  );
}
