import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const STUDENT_ID = "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getStudentIdentity } from "./student-identity-resolver";

function studentQuery(response: unknown) {
  const result = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };

  result.select.mockReturnValue(result);
  result.eq.mockReturnValue(result);
  result.maybeSingle.mockResolvedValue(response);
  return result;
}

describe("student identity resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated without querying the student table", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from,
    });

    const result = await getStudentIdentity();

    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves only the profile bound to the authenticated Auth user with its activation state", async () => {
    const query = studentQuery({
      data: {
        activation_status: "pending",
        auth_user_id: USER_ID,
        date_of_birth: "2000-01-01",
        email: "student@example.com",
        first_name: "Ada",
        id: STUDENT_ID,
        is_active: true,
        national_id: "0102030405",
        phone: null,
        surname: "Lovelace",
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from,
    });

    const result = await getStudentIdentity();

    expect(result).toEqual({
      ok: true,
      student: {
        activationStatus: "pending",
        authUserId: USER_ID,
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
    expect(from).toHaveBeenCalledWith("students");
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("activation_status")
    );
    expect(query.eq).toHaveBeenCalledWith("auth_user_id", USER_ID);
  });

  it("fails closed when the persisted activation state is not recognized", async () => {
    const query = studentQuery({
      data: {
        activation_status: "unknown",
        auth_user_id: USER_ID,
        date_of_birth: "2000-01-01",
        email: "student@example.com",
        first_name: "Ada",
        id: STUDENT_ID,
        is_active: true,
        national_id: "0102030405",
        phone: null,
        surname: "Lovelace",
      },
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(query),
    });

    await expect(getStudentIdentity()).resolves.toEqual({
      ok: false,
      reason: "no_student",
    });
  });
});
