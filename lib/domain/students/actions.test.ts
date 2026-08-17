/**
 * U3-S2A Contract Tests: createStudent action.
 * Mocked boundary — no DB, no auth runtime.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const STUDENT_ID = "f1e2d3c4-b5a6-4f7e-8d9c-0a1b2c3d4e5f";

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    mockWithAuthenticatedUser(...args),
}));

vi.mock("./schema", async () => {
  const actual = await vi.importActual<typeof import("./schema")>("./schema");
  return actual;
});

import { createStudent } from "./actions";

const validInput = {
  branch_id: UUID,
  first_name: "Juan",
  surname: "Pérez",
  national_id: "12345678",
  email: "juan@example.com",
  date_of_birth: "1995-03-15",
  is_active: true,
};

/** Mock context with valid admin assignment for the branch */
const mockCtx = {
  userId: "u1",
  roles: ["admin" as const],
  assignments: [{ role: "admin" as const, branchId: UUID }],
};

describe("createStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const tx = {
        students: { create: mockCreate },
        branches: { findUnique: mockFindUnique },
      };
      const data = await fn(tx, mockCtx);
      return { success: true, data };
    });
    mockCreate.mockResolvedValue({ id: STUDENT_ID });
    mockFindUnique.mockResolvedValue({ id: UUID, is_active: true });
  });

  it("rejects invalid input before calling withAuthenticatedUser", async () => {
    const result = await createStudent({ ...validInput, email: "bad" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("correo");
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("passes exact create payload with date conversion and select", async () => {
    await createStudent(validInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        branch_id: UUID,
        first_name: "Juan",
        surname: "Pérez",
        national_id: "12345678",
        email: "juan@example.com",
        date_of_birth: new Date("1995-03-15"),
        is_active: true,
      },
      select: { id: true },
    });
  });

  it("returns only { id } on success", async () => {
    const result = await createStudent(validInput);

    expect(result).toEqual({ success: true, data: { id: STUDENT_ID } });
  });

  it("propagates executor failure without remapping", async () => {
    mockWithAuthenticatedUser.mockResolvedValue({
      success: false,
      error: "An unexpected error occurred",
    });

    const result = await createStudent(validInput);

    expect(result).toEqual({
      success: false,
      error: "An unexpected error occurred",
    });
  });

  it("propagates authentication failure", async () => {
    mockWithAuthenticatedUser.mockResolvedValue({
      success: false,
      error: "Authentication required",
    });

    const result = await createStudent(validInput);

    expect(result).toEqual({
      success: false,
      error: "Authentication required",
    });
  });
});
