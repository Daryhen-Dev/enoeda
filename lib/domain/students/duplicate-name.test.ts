/**
 * T3 contract tests: findStudentsWithSameName (duplicate name warning).
 * Mocked boundary — no DB, no auth runtime.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const OTHER_BRANCH = "bbbbbbbb-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";

const mockFindMany = vi.fn();
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

import { findStudentsWithSameName } from "./actions";
import { STUDENT_DUPLICATE_NAME_LIMIT, studentDuplicateNameSchema } from "./schema";

/** Minimal mock of the authenticated caller context used by these tests. */
interface MockAuthCtx {
  userId: string;
  roles: string[];
  assignments: { role: string; branchId: string }[];
}

/** Context with a valid admin assignment for BRANCH_ID */
const validAdminCtx: MockAuthCtx = {
  userId: "u1",
  roles: ["admin" as const],
  assignments: [{ role: "admin" as const, branchId: BRANCH_ID }],
};

/** Context with NO assignment for BRANCH_ID */
const noAssignmentCtx = {
  userId: "u1",
  roles: ["admin" as const],
  assignments: [{ role: "admin" as const, branchId: OTHER_BRANCH }],
};

/** Context with teacher assignment for BRANCH_ID */
const validTeacherCtx = {
  userId: "u1",
  roles: ["teacher" as const],
  assignments: [{ role: "teacher" as const, branchId: BRANCH_ID }],
};

/** Teacher roles but only a non-teacher operational assignment for the branch:
 *  branch context passes, so the A6 defense-in-depth check is what denies. */
const teacherWithoutBranchCtx = {
  userId: "u1",
  roles: ["teacher" as const],
  assignments: [{ role: "admin" as const, branchId: BRANCH_ID }],
};

const setupWithAuth = (ctx: MockAuthCtx) => {
  mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
    const tx = { students: { findMany: mockFindMany } };
    const data = await fn(tx, ctx);
    return { success: true, data };
  });
}

const validInput = {
  branch_id: BRANCH_ID,
  first_name: "Juan",
  surname: "Pérez",
};

describe("studentDuplicateNameSchema — normalization", () => {
  it("trims and collapses inner whitespace like the stored value", () => {
    const parsed = studentDuplicateNameSchema.parse({
      branch_id: BRANCH_ID,
      first_name: "  Juan   Carlos  ",
      surname: "\tPérez\n Gómez ",
    });
    expect(parsed.first_name).toBe("Juan Carlos");
    expect(parsed.surname).toBe("Pérez Gómez");
  });

  it.each([
    ["missing first_name", { branch_id: BRANCH_ID, surname: "Pérez" }],
    ["blank first_name", { branch_id: BRANCH_ID, first_name: "   ", surname: "Pérez" }],
    ["missing surname", { branch_id: BRANCH_ID, first_name: "Juan" }],
    ["blank surname", { branch_id: BRANCH_ID, first_name: "Juan", surname: "" }],
    ["invalid branch_id", { branch_id: "nope", first_name: "Juan", surname: "Pérez" }],
    ["unknown extra key", { ...validInput, is_active: true }],
  ])("rejects %s", (_label, input) => {
    expect(studentDuplicateNameSchema.safeParse(input).success).toBe(false);
  });
});

describe("findStudentsWithSameName — branch security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("rejects invalid input before calling withAuthenticatedUser", async () => {
    const result = await findStudentsWithSameName({ branch_id: "nope", first_name: "Juan", surname: "Pérez" });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment for target branch", async () => {
    setupWithAuth(noAssignmentCtx);

    const result = await findStudentsWithSameName(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("rejects a teacher without an assignment for the target branch (A6)", async () => {
    setupWithAuth(teacherWithoutBranchCtx);

    const result = await findStudentsWithSameName(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("accepts a teacher with an assignment for the target branch", async () => {
    setupWithAuth(validTeacherCtx);

    const result = await findStudentsWithSameName(validInput);

    expect(result.success).toBe(true);
    expect(mockFindMany).toHaveBeenCalled();
  });
});

describe("findStudentsWithSameName — lookup behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    setupWithAuth(validAdminCtx);
  });

  it("scopes the query to the requested branch", async () => {
    await findStudentsWithSameName(validInput);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch_id: BRANCH_ID }),
      })
    );
  });

  it("matches first name AND surname case-insensitively (equals + mode insensitive)", async () => {
    await findStudentsWithSameName(validInput);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branch_id: BRANCH_ID,
          first_name: { equals: "Juan", mode: "insensitive" },
          surname: { equals: "Pérez", mode: "insensitive" },
        },
      })
    );
  });

  it("includes active AND inactive students (no is_active filter)", async () => {
    await findStudentsWithSameName(validInput);

    const call = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).not.toHaveProperty("is_active");
  });

  it(`takes at most ${STUDENT_DUPLICATE_NAME_LIMIT} matches`, async () => {
    await findStudentsWithSameName(validInput);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: STUDENT_DUPLICATE_NAME_LIMIT,
        orderBy: [{ surname: "asc" }, { first_name: "asc" }, { id: "asc" }],
      })
    );
  });

  it("returns mapped matches with is_active and activation_status", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: STUDENT_ID,
        first_name: "Juan",
        surname: "Pérez",
        national_id: "1712345678",
        is_active: true,
        activation_status: "active",
      },
      {
        id: "dddddddd-1111-4222-a333-444444444444",
        first_name: "Juan",
        surname: "Pérez",
        national_id: null,
        is_active: false,
        activation_status: "pending",
      },
    ]);

    const result = await findStudentsWithSameName(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.matches).toEqual([
      {
        id: STUDENT_ID,
        first_name: "Juan",
        surname: "Pérez",
        national_id: "1712345678",
        is_active: true,
        activation_status: "active",
      },
      {
        id: "dddddddd-1111-4222-a333-444444444444",
        first_name: "Juan",
        surname: "Pérez",
        national_id: null,
        is_active: false,
        activation_status: "pending",
      },
    ]);
  });

  it("fails closed with the generic error for an invalid activation_status row", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: STUDENT_ID,
        first_name: "Juan",
        surname: "Pérez",
        national_id: null,
        is_active: true,
        activation_status: "bogus",
      },
    ]);

    const result = await findStudentsWithSameName(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.UNEXPECTED_ERROR);
  });

  it("normalizes the search input before querying (trim + collapsed whitespace)", async () => {
    await findStudentsWithSameName({
      branch_id: BRANCH_ID,
      first_name: "  Juan   Carlos ",
      surname: " Pérez ",
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          first_name: { equals: "Juan Carlos", mode: "insensitive" },
          surname: { equals: "Pérez", mode: "insensitive" },
        }),
      })
    );
  });

  it("rejects a schema-invalid surname with the required-field copy", async () => {
    const result = await findStudentsWithSameName({
      branch_id: BRANCH_ID,
      first_name: "Juan",
      surname: "",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(STUDENT_MESSAGES.SURNAME_REQUIRED);
  });
});
