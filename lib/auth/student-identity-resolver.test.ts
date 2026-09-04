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

import {
  getStudentEnrollmentContext,
  getStudentIdentity,
} from "./student-identity-resolver";

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

  it("resolves only the profile bound to the authenticated Auth user", async () => {
    const query = studentQuery({
      data: {
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
    expect(query.eq).toHaveBeenCalledWith("auth_user_id", USER_ID);
  });

  it("returns the pending invitation state for a signed-in user without a linked student", async () => {
    const studentLookup = studentQuery({ data: null, error: null });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          email: "student@example.com",
          password_set_at: null,
          state: "pending",
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(studentLookup),
      rpc,
    });

    const result = await getStudentEnrollmentContext();

    expect(result).toEqual({
      kind: "invitation",
      invitation: {
        email: "student@example.com",
        passwordConfigured: false,
        state: "pending",
      },
    });
    expect(rpc).toHaveBeenCalledWith("get_my_student_enrollment_state");
  });

  it("fails closed when an unrecognized invitation state is returned", async () => {
    const studentLookup = studentQuery({ data: null, error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(studentLookup),
      rpc: vi.fn().mockResolvedValue({
        data: [{ email: "student@example.com", password_set_at: null, state: "unknown" }],
        error: null,
      }),
    });

    const result = await getStudentEnrollmentContext();

    expect(result).toEqual({ kind: "invalid" });
  });
});
