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

import { COMMON_MESSAGES, STUDENT_MESSAGES } from "@/lib/localization/es-ec";

import { createStudent, updateStudent } from "./actions";

const validInput = {
  branch_id: UUID,
  first_name: "Juan",
  surname: "Pérez",
  national_id: "12345678",
  email: "juan@example.com",
  date_of_birth: "1995-03-15",
  is_active: true,
};

/** Minimal input: only names required; identity fields stored as NULL. */
const minimalInput = {
  branch_id: UUID,
  first_name: "Juan",
  surname: "Pérez",
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
        phone: null,
        email: "juan@example.com",
        date_of_birth: new Date("1995-03-15"),
        is_active: true,
      },
      select: { id: true },
    });
  });

  it("writes NULLs for omitted identity fields", async () => {
    await createStudent(minimalInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        branch_id: UUID,
        first_name: "Juan",
        surname: "Pérez",
        national_id: null,
        phone: null,
        email: null,
        date_of_birth: null,
        is_active: true,
      },
      select: { id: true },
    });
  });

  it.each([
    [
      "students_national_id_uq",
      STUDENT_MESSAGES.NATIONAL_ID_TAKEN,
    ],
    [
      "students_email_normalized_uq",
      STUDENT_MESSAGES.EMAIL_TAKEN,
    ],
  ])(
    "maps unique violation on %s to a clear message",
    async (constraint, expectedMessage) => {
      mockWithAuthenticatedUser.mockImplementation(
        async (
          fn: (tx: unknown, ctx: unknown) => unknown,
          options?: { mapTransactionError?: (error: unknown) => string | undefined }
        ) => {
          const tx = {
            students: { create: mockCreate },
            branches: { findUnique: mockFindUnique },
          };
          try {
            const data = await fn(tx, mockCtx);
            return { success: true, data };
          } catch (error) {
            return {
              success: false,
              error:
                options?.mapTransactionError?.(error) ??
                COMMON_MESSAGES.UNEXPECTED_ERROR,
            };
          }
        }
      );
      // Real @prisma/adapter-pg P2002 shape: the message lists only the
      // fields; the constraint name is in the driver adapter cause.
      mockCreate.mockRejectedValue(
        Object.assign(
          new Error(
            "Invalid `tx.students.create()` invocation:\n\nUnique constraint failed on the fields: (`national_id`)"
          ),
          {
            code: "P2002",
            meta: {
              modelName: "students",
              driverAdapterError: {
                name: "DriverAdapterError",
                cause: {
                  originalCode: "23505",
                  originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
                  kind: "UniqueConstraintViolation",
                },
              },
            },
          }
        )
      );

      const result = await createStudent(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe(expectedMessage);
    }
  );

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

describe("updateStudent — clearing optional fields", () => {
  const STUDENT_IN_BRANCH = {
    id: STUDENT_ID,
    branch_id: UUID,
    is_active: true,
  };
  const mockUpdate = vi.fn();
  const mockUpdateFindUnique = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuthenticatedUser.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          students: {
            findUnique: mockUpdateFindUnique,
            update: mockUpdate,
          },
          branches: { findUnique: vi.fn() },
        };
        const data = await fn(tx, mockCtx);
        return { success: true, data };
      }
    );
    mockUpdateFindUnique.mockResolvedValue(STUDENT_IN_BRANCH);
    mockUpdate.mockResolvedValue({ id: STUDENT_ID });
  });

  it("stores a cleared date_of_birth as null instead of a Date", async () => {
    const result = await updateStudent(
      { id: STUDENT_ID, date_of_birth: "" },
      UUID
    );

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: STUDENT_ID },
      data: { date_of_birth: null },
      select: { id: true },
    });
  });

  it("passes cleared national_id and email as null", async () => {
    await updateStudent(
      { id: STUDENT_ID, national_id: "", email: "" },
      UUID
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: STUDENT_ID },
      data: { national_id: null, email: null },
      select: { id: true },
    });
  });

  it("omits untouched fields from the update payload", async () => {
    await updateStudent({ id: STUDENT_ID, first_name: "Ana" }, UUID);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: STUDENT_ID },
      data: { first_name: "Ana" },
      select: { id: true },
    });
  });
});
