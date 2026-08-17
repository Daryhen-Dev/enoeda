/**
 * Student actions branch-scoping tests.
 *
 * Validates that:
 * - listStudents requires branch_id (mandatory) and validates caller assignment
 * - getStudentById requires branch and validates caller assignment + ownership
 * - deactivateStudent requires branch context and validates ownership
 * - updateStudent requires branch context and rejects cross-branch mutations
 * - reactivateStudent requires branch context
 * - createStudent validates caller branch assignment
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    mockWithAuthenticatedUser(...args),
}));

vi.mock("./schema", async () => {
  const actual = await vi.importActual<typeof import("./schema")>("./schema");
  return actual;
});

import {
  listStudents,
  getStudentById,
  deactivateStudent,
  updateStudent,
  reactivateStudent,
  createStudent,
} from "./actions";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const OTHER_BRANCH = "bbbbbbbb-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";

/** Context with a valid admin assignment for BRANCH_ID */
const validAdminCtx = {
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

describe("listStudents — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input (schema level)", async () => {
    const result = await listStudents({});

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects invalid branch_id format", async () => {
    const result = await listStudents({ branch_id: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment for target branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findMany: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("succeeds with valid branch_id and matching assignment", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findMany: mockFindMany } };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.success).toBe(true);
    expect(mockFindMany).toHaveBeenCalled();
    const findManyArgs = mockFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("branch_id", BRANCH_ID);
  });

  it("teacher assignment also satisfies the assertion", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findMany: mockFindMany } };
      const data = await fn(tx, validTeacherCtx);
      return { success: true, data };
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.success).toBe(true);
  });
});

describe("getStudentById — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId argument is empty", async () => {
    const result = await getStudentById(STUDENT_ID, "");

    expect(result.success).toBe(false);
    expect(result.error).toContain("requerido");
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment for target branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await getStudentById(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects when student belongs to different branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: OTHER_BRANCH,
            first_name: "Test",
            surname: "Student",
            national_id: "123",
            email: "test@test.com",
            date_of_birth: new Date("2000-01-01"),
            is_active: true,
          }),
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await getStudentById(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(false);
  });

  it("returns student when branch assignment and ownership match", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: BRANCH_ID,
            first_name: "Test",
            surname: "Student",
            national_id: "123",
            email: "test@test.com",
            date_of_birth: new Date("2000-01-01"),
            is_active: true,
          }),
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await getStudentById(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.id).toBe(STUDENT_ID);
    }
  });
});

describe("deactivateStudent — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId argument is empty", async () => {
    const result = await deactivateStudent(STUDENT_ID, "");

    expect(result.success).toBe(false);
    expect(result.error).toContain("requerido");
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await deactivateStudent(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch deactivation (student in other branch)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: OTHER_BRANCH,
            is_active: true,
          }),
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await deactivateStudent(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(false);
  });

  it("succeeds when branch context and ownership match", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ id: STUDENT_ID });
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: BRANCH_ID,
            is_active: true,
          }),
          update: mockUpdate,
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await deactivateStudent(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("updateStudent — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branchId is missing", async () => {
    const result = await updateStudent(
      { id: STUDENT_ID, first_name: "New" },
      undefined
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("requerido");
  });

  it("rejects cross-branch transfer via raw branch_id field", async () => {
    const result = await updateStudent(
      { id: STUDENT_ID, branch_id: OTHER_BRANCH },
      BRANCH_ID
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await updateStudent(
      { id: STUDENT_ID, first_name: "New" },
      BRANCH_ID
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects when student belongs to different branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: OTHER_BRANCH,
            is_active: true,
          }),
          update: vi.fn(),
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await updateStudent(
      { id: STUDENT_ID, first_name: "New" },
      BRANCH_ID
    );

    expect(result.success).toBe(false);
  });

  it("succeeds when branch context and ownership match", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ id: STUDENT_ID });
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({
            id: STUDENT_ID,
            branch_id: BRANCH_ID,
            is_active: false,
          }),
          update: mockUpdate,
        },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await updateStudent(
      { id: STUDENT_ID, first_name: "New" },
      BRANCH_ID
    );

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("reactivateStudent — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when callerBranchId is missing", async () => {
    const result = await reactivateStudent(
      { id: STUDENT_ID },
      undefined
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("requerido");
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { students: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await reactivateStudent(
      { id: STUDENT_ID },
      BRANCH_ID
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });
});

describe("createStudent — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects caller without active assignment for the target branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: { create: vi.fn() },
        branches: { findUnique: vi.fn() },
      };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await createStudent({
      branch_id: BRANCH_ID,
      first_name: "Juan",
      surname: "Pérez",
      national_id: "12345678",
      email: "juan@test.com",
      date_of_birth: "1995-03-15",
      is_active: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });
});
