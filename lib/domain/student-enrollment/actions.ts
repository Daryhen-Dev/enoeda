"use server";

import { assertCallerBranchAdmin } from "@/lib/auth/branch-assertion";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { getStudentIdentity } from "@/lib/auth/student-identity-resolver";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  COMMON_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  completeStudentEnrollmentSchema,
  createStudentInvitationSchema,
  studentEnrollmentPasswordSchema,
  studentInvitationIdSchema,
  updateOwnStudentPhoneSchema,
} from "./schema";
import {
  STUDENT_INVITATION_STATES,
  isStudentInvitationState,
  type StudentEnrollmentActionResult,
  type StudentInvitationListItem,
  type StudentInvitationState,
} from "./types";

type StudentInvitationRow =
  Database["public"]["Tables"]["student_invitations"]["Row"];

interface BranchAdminActor {
  userId: string;
}

interface InvitationIssueInput {
  branchId: string;
  email: string;
  issuedBy: string;
}

interface InvitationLoadResult {
  invitation: StudentInvitationRow;
}

function actionError<T>(error: string): StudentEnrollmentActionResult<T> {
  return { success: false, error };
}

function toActionIdentityError<T>(): StudentEnrollmentActionResult<T> {
  return actionError(COMMON_MESSAGES.AUTHENTICATION_REQUIRED);
}

function invitationStateFor(row: StudentInvitationRow): StudentInvitationState {
  if (
    row.state === STUDENT_INVITATION_STATES.PENDING &&
    Date.parse(row.expires_at) <= Date.now()
  ) {
    return STUDENT_INVITATION_STATES.EXPIRED;
  }

  return isStudentInvitationState(row.state)
    ? row.state
    : STUDENT_INVITATION_STATES.NEEDS_REVIEW;
}

function toInvitationListItem(
  row: StudentInvitationRow
): StudentInvitationListItem {
  return {
    branchId: row.branch_id,
    createdAt: row.created_at,
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    passwordConfigured: row.password_set_at !== null,
    state: invitationStateFor(row),
  };
}

function enrollmentStateMessage(state: string): string {
  if (state === STUDENT_INVITATION_STATES.EXPIRED) {
    return STUDENT_ENROLLMENT_MESSAGES.INVITATION_EXPIRED;
  }
  if (state === STUDENT_INVITATION_STATES.REVOKED) {
    return STUDENT_ENROLLMENT_MESSAGES.INVITATION_REVOKED;
  }
  if (state === STUDENT_INVITATION_STATES.NEEDS_REVIEW) {
    return STUDENT_ENROLLMENT_MESSAGES.NEEDS_REVIEW;
  }
  if (state === "password_required") {
    return STUDENT_ENROLLMENT_MESSAGES.PASSWORD_REQUIRED;
  }
  return STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE;
}

async function requireBranchAdmin(
  branchId: string
): Promise<StudentEnrollmentActionResult<BranchAdminActor>> {
  const identity = await getAuthenticatedContext();
  if (!identity.ok) {
    return toActionIdentityError();
  }

  const branchError = assertCallerBranchAdmin(identity.ctx, branchId);
  if (branchError) {
    return actionError(branchError);
  }

  return { success: true, data: { userId: identity.ctx.userId } };
}

function getInvitationRedirectUrl(): string | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) {
    return null;
  }

  try {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") {
      return null;
    }
    return new URL("/auth/callback?next=%2Fenroll", origin).toString();
  } catch {
    return null;
  }
}

async function cleanupUnclaimedInvitationUser(
  admin: ReturnType<typeof createAdminClient>,
  invitation: Pick<StudentInvitationRow, "auth_user_id" | "student_id">
): Promise<boolean> {
  if (invitation.auth_user_id === null || invitation.student_id !== null) {
    return false;
  }

  const { data: linkedStudent, error: lookupError } = await admin
    .from("students")
    .select("id")
    .eq("auth_user_id", invitation.auth_user_id)
    .maybeSingle();

  if (lookupError || linkedStudent !== null) {
    return false;
  }

  const { error } = await admin.auth.admin.deleteUser(invitation.auth_user_id);
  return !error;
}

async function issueInvitation(
  admin: ReturnType<typeof createAdminClient>,
  input: InvitationIssueInput
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const redirectTo = getInvitationRedirectUrl();
  if (redirectTo === null) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_CONFIGURATION_REQUIRED);
  }

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo });
  const invitedUser = inviteData.user;

  if (inviteError || invitedUser === null) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_DELIVERY_FAILURE);
  }

  const { data: persistedInvitation, error: persistenceError } = await admin
    .from("student_invitations")
    .insert({
      auth_user_id: invitedUser.id,
      branch_id: input.branchId,
      created_by: input.issuedBy,
      email: input.email,
    })
    .select("id")
    .maybeSingle();

  if (persistenceError || persistedInvitation === null) {
    await cleanupUnclaimedInvitationUser(admin, {
      auth_user_id: invitedUser.id,
      student_id: null,
    });
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
  }

  return { success: true, data: { id: persistedInvitation.id } };
}

async function loadInvitationForBranchAdmin(
  invitationId: string
): Promise<StudentEnrollmentActionResult<InvitationLoadResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_invitations")
    .select(
      "id, branch_id, email, auth_user_id, state, expires_at, password_set_at, accepted_at, revoked_at, student_id, created_by, created_at, updated_at"
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (error || data === null) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE);
  }

  const authorization = await requireBranchAdmin(data.branch_id);
  if (!authorization.success) {
    return actionError(authorization.error ?? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
  }

  return { success: true, data: { invitation: data } };
}

export async function listStudentInvitations(
  input: unknown
): Promise<StudentEnrollmentActionResult<StudentInvitationListItem[]>> {
  const parsed = createStudentInvitationSchema
    .pick({ branch_id: true })
    .safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const authorization = await requireBranchAdmin(parsed.data.branch_id);
  if (!authorization.success) {
    return actionError(authorization.error ?? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_invitations")
    .select(
      "id, branch_id, email, auth_user_id, state, expires_at, password_set_at, accepted_at, revoked_at, student_id, created_by, created_at, updated_at"
    )
    .eq("branch_id", parsed.data.branch_id)
    .order("created_at", { ascending: false });

  if (error) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_LOAD_FAILURE);
  }

  return { success: true, data: (data ?? []).map(toInvitationListItem) };
}

export async function createStudentInvitation(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const parsed = createStudentInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const authorization = await requireBranchAdmin(parsed.data.branch_id);
  if (!authorization.success || authorization.data === undefined) {
    return actionError(authorization.error ?? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
  }

  const supabase = await createClient();
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, is_active")
    .eq("id", parsed.data.branch_id)
    .maybeSingle();

  if (branchError || branch === null || !branch.is_active) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.ACTIVE_BRANCH_REQUIRED);
  }

  return issueInvitation(createAdminClient(), {
    branchId: parsed.data.branch_id,
    email: parsed.data.email,
    issuedBy: authorization.data.userId,
  });
}

export async function resendStudentInvitation(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const parsed = studentInvitationIdSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const loaded = await loadInvitationForBranchAdmin(parsed.data.id);
  if (!loaded.success || loaded.data === undefined) {
    return actionError(loaded.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE);
  }

  const { invitation } = loaded.data;
  if (invitationStateFor(invitation) === STUDENT_INVITATION_STATES.ACCEPTED) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_ALREADY_ACCEPTED);
  }

  const admin = createAdminClient();
  const { error: revokeError } = await admin
    .from("student_invitations")
    .update({
      state: STUDENT_INVITATION_STATES.REVOKED,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  if (revokeError) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
  }

  if (invitation.auth_user_id !== null) {
    const deleted = await cleanupUnclaimedInvitationUser(admin, invitation);
    if (!deleted) {
      return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_REQUIRES_REVIEW);
    }
  }

  const authorization = await requireBranchAdmin(invitation.branch_id);
  if (!authorization.success || authorization.data === undefined) {
    return actionError(authorization.error ?? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
  }

  return issueInvitation(admin, {
    branchId: invitation.branch_id,
    email: invitation.email,
    issuedBy: authorization.data.userId,
  });
}

export async function revokeStudentInvitation(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ revoked: boolean }>> {
  const parsed = studentInvitationIdSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const loaded = await loadInvitationForBranchAdmin(parsed.data.id);
  if (!loaded.success || loaded.data === undefined) {
    return actionError(loaded.error ?? STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE);
  }

  const { invitation } = loaded.data;
  if (invitationStateFor(invitation) === STUDENT_INVITATION_STATES.ACCEPTED) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_ALREADY_ACCEPTED);
  }

  const admin = createAdminClient();
  if (invitation.state !== STUDENT_INVITATION_STATES.REVOKED) {
    const { error } = await admin
      .from("student_invitations")
      .update({
        state: STUDENT_INVITATION_STATES.REVOKED,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (error) {
      return actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_SAVE_FAILURE);
    }
  }

  if (invitation.auth_user_id !== null && invitation.student_id === null) {
    await cleanupUnclaimedInvitationUser(admin, invitation);
  }

  return { success: true, data: { revoked: true } };
}

export async function setStudentEnrollmentPassword(
  input: unknown
): Promise<StudentEnrollmentActionResult<void>> {
  const parsed = studentEnrollmentPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data: enrollmentStates, error: enrollmentStateError } =
    await supabase.rpc("get_my_student_enrollment_state");
  const enrollmentState = enrollmentStates?.[0]?.state;

  if (
    enrollmentStateError ||
    enrollmentState !== STUDENT_INVITATION_STATES.PENDING
  ) {
    return actionError(enrollmentStateMessage(enrollmentState ?? "invalid"));
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.PASSWORD_SAVE_FAILURE);
  }

  const { data: state, error: stateError } = await supabase.rpc(
    "mark_student_invitation_password_set"
  );
  if (stateError || state !== STUDENT_INVITATION_STATES.PENDING) {
    return actionError(enrollmentStateMessage(state ?? "invalid"));
  }

  return { success: true, data: undefined };
}

export async function completeStudentEnrollment(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const parsed = completeStudentEnrollmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_student_enrollment", {
    p_date_of_birth: parsed.data.date_of_birth,
    p_first_name: parsed.data.first_name,
    p_national_id: parsed.data.national_id,
    p_phone: parsed.data.phone ?? null,
    p_surname: parsed.data.surname,
  });
  const result = data?.[0];

  if (error || result === undefined) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_SAVE_FAILURE);
  }

  if (
    result.state === STUDENT_INVITATION_STATES.ACCEPTED &&
    result.student_id !== null
  ) {
    return { success: true, data: { id: result.student_id } };
  }

  return actionError(enrollmentStateMessage(result.state));
}

export async function updateOwnStudentPhone(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const parsed = updateOwnStudentPhoneSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const identity = await getStudentIdentity();
  if (!identity.ok) {
    return identity.reason === "unauthenticated"
      ? toActionIdentityError()
      : actionError(STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE);
  }
  if (!identity.student.isActive) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_own_student_phone", {
    p_phone: parsed.data.phone ?? null,
  });

  if (error || data === null) {
    return actionError(
      error?.message.includes("inactive")
        ? STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY
        : STUDENT_ENROLLMENT_MESSAGES.PHONE_SAVE_FAILURE
    );
  }

  return { success: true, data: { id: data } };
}
