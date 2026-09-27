import { beforeEach, describe, expect, it, vi } from "vitest";

const BRANCH_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const AUTH_USER_ID = "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const STUDENT_ID = "c1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { registerPublicStudent } from "./service";

const input = {
  branch_id: BRANCH_ID,
  date_of_birth: "2010-06-15",
  email: "student@example.com",
  first_name: "Ana",
  national_id: "1234567890",
  password: "secure-password",
  phone: "0999999999",
  surname: "Pérez",
};

function query<T>(response: { data: T; error: { message: string } | null }) {
  const result = {
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  result.eq.mockReturnValue(result);
  result.insert.mockReturnValue(result);
  result.select.mockReturnValue(result);
  result.maybeSingle.mockResolvedValue(response);
  return result;
}

describe("registerPublicStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not create an Auth account when the selected branch is inactive or unavailable", async () => {
    const branchQuery = query({ data: null, error: null });
    const createUser = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { createUser } },
      from: vi.fn().mockReturnValue(branchQuery),
    });

    const result = await registerPublicStudent(input);

    expect(result).toEqual({ success: false });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates a confirmed Auth account and a pending, active student profile", async () => {
    const branchQuery = query({ data: { id: BRANCH_ID }, error: null });
    const studentQuery = query({ data: { id: STUDENT_ID }, error: null });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });
    const from = vi.fn()
      .mockReturnValueOnce(branchQuery)
      .mockReturnValueOnce(studentQuery);
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { createUser, deleteUser: vi.fn() } },
      from,
    });

    const result = await registerPublicStudent(input);

    expect(result).toEqual({ success: true, studentId: STUDENT_ID });
    expect(createUser).toHaveBeenCalledWith({
      email: input.email,
      email_confirm: true,
      password: input.password,
    });
    expect(studentQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        activation_status: "pending",
        auth_user_id: AUTH_USER_ID,
        is_active: true,
      })
    );
  });

  it("returns the same safe result for Auth duplicates without inserting a student", async () => {
    const branchQuery = query({ data: { id: BRANCH_ID }, error: null });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "duplicate" },
    });
    const from = vi.fn().mockReturnValue(branchQuery);
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { createUser } },
      from,
    });

    const result = await registerPublicStudent(input);

    expect(result).toEqual({ success: false });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("deletes the newly-created Auth account when profile insertion fails", async () => {
    const branchQuery = query({ data: { id: BRANCH_ID }, error: null });
    const studentQuery = query({
      data: null,
      error: { message: "unique violation" },
    });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn()
      .mockReturnValueOnce(branchQuery)
      .mockReturnValueOnce(studentQuery);
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { createUser, deleteUser } },
      from,
    });

    const result = await registerPublicStudent(input);

    expect(result).toEqual({ success: false });
    expect(deleteUser).toHaveBeenCalledWith(AUTH_USER_ID);
  });
});
