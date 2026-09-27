import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMMON_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";

const STUDENT_ID = "d1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getStudentIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth/student-identity-resolver", () => ({
  STUDENT_IDENTITY_REASONS: {
    NO_STUDENT: "no_student",
    UNAUTHENTICATED: "unauthenticated",
  },
  getStudentIdentity: mocks.getStudentIdentity,
}));

import { updateOwnStudentPhone } from "./actions";

const pendingStudent = {
  activationStatus: "pending",
  authUserId: "c1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  dateOfBirth: "2000-01-01",
  email: "student@example.com",
  firstName: "Ada",
  id: STUDENT_ID,
  isActive: true,
  nationalId: "0102030405",
  phone: null,
  surname: "Lovelace",
};

describe("updateOwnStudentPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid phone before resolving student identity", async () => {
    const result = await updateOwnStudentPhone({ phone: "1".repeat(31) });

    expect(result.success).toBe(false);
    expect(mocks.getStudentIdentity).not.toHaveBeenCalled();
  });

  it("permits a pending but active student to update only the phone through the narrow RPC", async () => {
    mocks.getStudentIdentity.mockResolvedValue({ ok: true, student: pendingStudent });
    const rpc = vi.fn().mockResolvedValue({ data: STUDENT_ID, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({ success: true, data: { id: STUDENT_ID } });
    expect(rpc).toHaveBeenCalledWith("update_own_student_phone", {
      p_phone: "0999999999",
    });
  });

  it("keeps a suspended student profile read-only without invoking the update RPC", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: { ...pendingStudent, isActive: false },
    });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not expose the phone RPC to an authenticated user without a student profile", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: false,
      reason: "no_student",
    });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({
      success: false,
      error: STUDENT_ENROLLMENT_MESSAGES.PROFILE_UNAVAILABLE,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns an authentication error without invoking the phone RPC", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    const result = await updateOwnStudentPhone({ phone: "0999999999" });

    expect(result).toEqual({
      success: false,
      error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
