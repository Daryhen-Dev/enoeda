import { beforeEach, describe, expect, it, vi } from "vitest";

import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const INVITATION_ID = "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const INVITED_AUTH_USER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const NEW_INVITATION_ID = "e1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const STUDENT_ID = "d1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getAuthenticatedContext: vi.fn(),
  getStudentIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: mocks.getAuthenticatedContext,
}));
vi.mock("@/lib/auth/student-identity-resolver", () => ({
  getStudentIdentity: mocks.getStudentIdentity,
}));

import {
  completeStudentEnrollment,
  createStudentInvitation,
  listStudentInvitations,
  resendStudentInvitation,
  revokeStudentInvitation,
  setStudentEnrollmentPassword,
  updateOwnStudentPhone,
} from "./actions";

interface QueryResponse<T> {
  data: T;
  error: { message: string } | null;
}

function query<T>(response: QueryResponse<T>) {
  const result = {
    eq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  result.select.mockReturnValue(result);
  result.eq.mockReturnValue(result);
  result.in.mockReturnValue(result);
  result.order.mockResolvedValue(response);
  result.maybeSingle.mockResolvedValue(response);
  result.insert.mockReturnValue(result);
  result.update.mockReturnValue(result);
  return result;
}

function activeBranchAdmin() {
  mocks.getAuthenticatedContext.mockResolvedValue({
    ok: true,
    ctx: {
      assignments: [{ branchId: BRANCH_ID, role: "admin" }],
      roles: ["admin"],
      userId: "admin-user-id",
    },
  });
}

function activeInvitation() {
  return {
    auth_user_id: INVITED_AUTH_USER_ID,
    branch_id: BRANCH_ID,
    created_at: "2026-08-29T10:00:00.000Z",
    created_by: "admin-user-id",
    email: "student@example.com",
    expires_at: "2026-09-05T10:00:00.000Z",
    id: INVITATION_ID,
    password_set_at: null,
    revoked_at: null,
    state: "pending",
    student_id: null,
    updated_at: "2026-08-29T10:00:00.000Z",
  };
}

describe("student enrollment actions", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.enoeda.test";
    vi.clearAllMocks();
  });

  it("rejects malformed invite input before resolving the actor", async () => {
    const result = await createStudentInvitation({
      branch_id: "invalid",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
  });

  it("never calls the service role client when the actor is not a branch admin", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        assignments: [{ branchId: BRANCH_ID, role: "teacher" }],
        roles: ["teacher"],
        userId: "teacher-user-id",
      },
    });

    const result = await createStudentInvitation({
      branch_id: BRANCH_ID,
      email: "student@example.com",
    });

    expect(result.success).toBe(false);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("keeps invitation listing on the user-scoped client after branch-admin authorization", async () => {
    activeBranchAdmin();
    const invitationQuery = query({ data: [activeInvitation()], error: null });
    const requestFrom = vi.fn().mockReturnValue(invitationQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const result = await listStudentInvitations({ branch_id: BRANCH_ID });

    expect(result.success).toBe(true);
    expect(requestFrom).toHaveBeenCalledWith("student_invitations");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("persists a new invitation through the authorized service-role client", async () => {
    activeBranchAdmin();
    const branchQuery = query({
      data: { id: BRANCH_ID, is_active: true },
      error: null,
    });
    const requestFrom = vi.fn().mockReturnValue(branchQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const invitationInsert = query({
      data: { id: NEW_INVITATION_ID },
      error: null,
    });
    const adminFrom = vi.fn().mockReturnValue(invitationInsert);
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: INVITED_AUTH_USER_ID } },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail } },
      from: adminFrom,
    });

    const result = await createStudentInvitation({
      branch_id: BRANCH_ID,
      email: "Student@Example.com",
    });

    expect(result).toEqual({
      success: true,
      data: { id: NEW_INVITATION_ID },
    });
    expect(requestFrom).toHaveBeenCalledTimes(1);
    expect(requestFrom).toHaveBeenCalledWith("branches");
    expect(adminFrom).toHaveBeenCalledWith("student_invitations");
    expect(invitationInsert.insert).toHaveBeenCalledWith({
      auth_user_id: INVITED_AUTH_USER_ID,
      branch_id: BRANCH_ID,
      created_by: "admin-user-id",
      email: "student@example.com",
    });
  });

  it("cleans up a newly invited unclaimed Auth user when invitation persistence fails", async () => {
    activeBranchAdmin();

    const branchQuery = query({
      data: { id: BRANCH_ID, is_active: true },
      error: null,
    });
    const requestFrom = vi.fn().mockReturnValue(branchQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const invitationInsert = query<null>({
      data: null,
      error: { message: "insert failed" },
    });
    const linkedStudentQuery = query<null>({ data: null, error: null });
    const adminFrom = vi
      .fn()
      .mockReturnValueOnce(invitationInsert)
      .mockReturnValueOnce(linkedStudentQuery);
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: INVITED_AUTH_USER_ID } },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser, inviteUserByEmail } },
      from: adminFrom,
    });

    const result = await createStudentInvitation({
      branch_id: BRANCH_ID,
      email: "Student@Example.com",
    });

    expect(result.success).toBe(false);
    expect(requestFrom).toHaveBeenCalledWith("branches");
    expect(adminFrom).toHaveBeenNthCalledWith(1, "student_invitations");
    expect(adminFrom).toHaveBeenNthCalledWith(2, "students");
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "student@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") })
    );
    expect(deleteUser).toHaveBeenCalledWith(INVITED_AUTH_USER_ID);
  });

  it("resends by revoking and reissuing through the authorized service-role client", async () => {
    activeBranchAdmin();
    const invitationQuery = query({ data: activeInvitation(), error: null });
    const requestFrom = vi.fn().mockReturnValue(invitationQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const revokeQuery = query<null>({ data: null, error: null });
    const linkedStudentQuery = query<null>({ data: null, error: null });
    const replacementInsert = query({
      data: { id: NEW_INVITATION_ID },
      error: null,
    });
    const adminFrom = vi
      .fn()
      .mockReturnValueOnce(revokeQuery)
      .mockReturnValueOnce(linkedStudentQuery)
      .mockReturnValueOnce(replacementInsert);
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: INVITED_AUTH_USER_ID } },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser, inviteUserByEmail } },
      from: adminFrom,
    });

    const result = await resendStudentInvitation({ id: INVITATION_ID });

    expect(result).toEqual({
      success: true,
      data: { id: NEW_INVITATION_ID },
    });
    expect(requestFrom).toHaveBeenCalledTimes(1);
    expect(requestFrom).toHaveBeenCalledWith("student_invitations");
    expect(invitationQuery.update).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenNthCalledWith(1, "student_invitations");
    expect(adminFrom).toHaveBeenNthCalledWith(2, "students");
    expect(adminFrom).toHaveBeenNthCalledWith(3, "student_invitations");
    expect(revokeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ state: "revoked" })
    );
    expect(replacementInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: BRANCH_ID,
        created_by: "admin-user-id",
        email: "student@example.com",
      })
    );
    expect(deleteUser).toHaveBeenCalledWith(INVITED_AUTH_USER_ID);
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "student@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") })
    );
  });

  it("stops resend after revocation when unclaimed Auth-user cleanup fails", async () => {
    activeBranchAdmin();
    const invitationQuery = query({ data: activeInvitation(), error: null });
    const requestFrom = vi.fn().mockReturnValue(invitationQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const revokeQuery = query<null>({ data: null, error: null });
    const linkedStudentQuery = query<null>({ data: null, error: null });
    const adminFrom = vi
      .fn()
      .mockReturnValueOnce(revokeQuery)
      .mockReturnValueOnce(linkedStudentQuery);
    const deleteUser = vi.fn().mockResolvedValue({
      error: { message: "delete failed" },
    });
    const inviteUserByEmail = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser, inviteUserByEmail } },
      from: adminFrom,
    });

    const result = await resendStudentInvitation({ id: INVITATION_ID });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_REQUIRES_REVIEW,
    });
    expect(invitationQuery.update).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenNthCalledWith(1, "student_invitations");
    expect(adminFrom).toHaveBeenNthCalledWith(2, "students");
    expect(revokeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ state: "revoked" })
    );
    expect(deleteUser).toHaveBeenCalledWith(INVITED_AUTH_USER_ID);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("keeps a revoked invitation revoked when unclaimed Auth-user cleanup fails", async () => {
    activeBranchAdmin();
    const invitationQuery = query({ data: activeInvitation(), error: null });
    const requestFrom = vi.fn().mockReturnValue(invitationQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const revokeQuery = query<null>({ data: null, error: null });
    const linkedStudentQuery = query<null>({ data: null, error: null });
    const adminFrom = vi
      .fn()
      .mockReturnValueOnce(revokeQuery)
      .mockReturnValueOnce(linkedStudentQuery);
    const deleteUser = vi.fn().mockResolvedValue({
      error: { message: "delete failed" },
    });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser } },
      from: adminFrom,
    });

    const result = await revokeStudentInvitation({ id: INVITATION_ID });

    expect(result).toEqual({ success: true, data: { revoked: true } });
    expect(invitationQuery.update).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenNthCalledWith(1, "student_invitations");
    expect(adminFrom).toHaveBeenNthCalledWith(2, "students");
    expect(revokeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ state: "revoked" })
    );
    expect(deleteUser).toHaveBeenCalledWith(INVITED_AUTH_USER_ID);
  });

  it("revokes invitation state without deleting an Auth account linked to a student", async () => {
    activeBranchAdmin();
    const invitationQuery = query({
      data: { ...activeInvitation(), student_id: STUDENT_ID },
      error: null,
    });
    const requestFrom = vi.fn().mockReturnValue(invitationQuery);
    mocks.createClient.mockResolvedValue({ from: requestFrom });

    const revokeQuery = query<null>({ data: null, error: null });
    const adminFrom = vi.fn().mockReturnValue(revokeQuery);
    const deleteUser = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser } },
      from: adminFrom,
    });

    const result = await revokeStudentInvitation({ id: INVITATION_ID });

    expect(result).toEqual({ success: true, data: { revoked: true } });
    expect(invitationQuery.update).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledWith("student_invitations");
    expect(revokeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ state: "revoked" })
    );
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not let a non-admin revoke an invitation that is otherwise readable", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue({
      ok: true,
      ctx: {
        assignments: [{ branchId: BRANCH_ID, role: "teacher" }],
        roles: ["teacher"],
        userId: "teacher-user-id",
      },
    });
    const invitationQuery = query({ data: activeInvitation(), error: null });
    const supabase = { from: vi.fn().mockReturnValue(invitationQuery) };
    mocks.createClient.mockResolvedValue(supabase);

    const result = await revokeStudentInvitation({ id: INVITATION_ID });

    expect(result.success).toBe(false);
    expect(invitationQuery.update).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses a password change when the caller has no usable invitation", async () => {
    const updateUser = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createClient.mockResolvedValue({ auth: { updateUser }, rpc });

    const result = await setStudentEnrollmentPassword({
      password: "secure-password",
    });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE,
    });
    expect(rpc).toHaveBeenCalledWith("get_my_student_enrollment_state");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a password change for an expired invitation", async () => {
    const updateUser = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          email: "student@example.com",
          password_set_at: null,
          state: "expired",
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ auth: { updateUser }, rpc });

    const result = await setStudentEnrollmentPassword({
      password: "secure-password",
    });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_EXPIRED,
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a password change for a revoked invitation", async () => {
    const updateUser = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          email: "student@example.com",
          password_set_at: null,
          state: "revoked",
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ auth: { updateUser }, rpc });

    const result = await setStudentEnrollmentPassword({
      password: "secure-password",
    });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_REVOKED,
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates a password only after a pending invitation preflight and records it", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            email: "student@example.com",
            password_set_at: null,
            state: "pending",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: "pending", error: null });
    mocks.createClient.mockResolvedValue({ auth: { updateUser }, rpc });

    const result = await setStudentEnrollmentPassword({
      password: "secure-password",
    });

    expect(result).toEqual({ success: true, data: undefined });
    expect(rpc).toHaveBeenNthCalledWith(1, "get_my_student_enrollment_state");
    expect(updateUser).toHaveBeenCalledWith({ password: "secure-password" });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "mark_student_invitation_password_set"
    );
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0]
    );
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[1]
    );
  });

  it("completes only the invited student profile and maps duplicate conflicts to needs review", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ state: "needs_review", student_id: null }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await completeStudentEnrollment({
      date_of_birth: "2000-01-01",
      first_name: "Ada",
      national_id: "0102030405",
      phone: "0999999999",
      surname: "Lovelace",
    });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.NEEDS_REVIEW,
    });
    expect(rpc).toHaveBeenCalledWith("complete_student_enrollment", {
      p_date_of_birth: "2000-01-01",
      p_first_name: "Ada",
      p_national_id: "0102030405",
      p_phone: "0999999999",
      p_surname: "Lovelace",
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("discipline");
  });

  it("uses the narrow phone RPC only for an active linked student", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: {
        authUserId: INVITED_AUTH_USER_ID,
        dateOfBirth: "2000-01-01",
        email: "student@example.com",
        firstName: "Ada",
        id: STUDENT_ID,
        isActive: true,
        nationalId: "0102030405",
        phone: null,
        surname: "Lovelace",
      },
    });
    const rpc = vi.fn().mockResolvedValue({ data: STUDENT_ID, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({ success: true, data: { id: STUDENT_ID } });
    expect(rpc).toHaveBeenCalledWith("update_own_student_phone", {
      p_phone: "0999999999",
    });
  });

  it("keeps inactive student profiles read-only without invoking the update RPC", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: {
        authUserId: INVITED_AUTH_USER_ID,
        dateOfBirth: "2000-01-01",
        email: "student@example.com",
        firstName: "Ada",
        id: STUDENT_ID,
        isActive: false,
        nationalId: "0102030405",
        phone: null,
        surname: "Lovelace",
      },
    });
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not expose the phone RPC to an authenticated user without a student profile", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: false,
      reason: "no_student",
    });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_UNAVAILABLE,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
