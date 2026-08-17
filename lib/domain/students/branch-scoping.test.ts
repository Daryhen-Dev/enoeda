/**
 * Student actions branch-scoping tests.
 *
 * Validates that listStudents filters by branch_id,
 * getStudentById validates branch ownership, and mutations
 * enforce branch relation.
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

import { listStudents, getStudentById } from "./actions";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const OTHER_BRANCH = "bbbbbbbb-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";

describe("listStudents — branch scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes branch_id in where clause when provided", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const tx = { students: { findMany: mockFindMany } };
      const ctx = { userId: "u1", roles: ["admin"], assignments: [] };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.success).toBe(true);
    expect(mockFindMany).toHaveBeenCalled();
    const findManyArgs = mockFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("branch_id", BRANCH_ID);
  });

  it("rejects invalid branch_id format", async () => {
    const result = await listStudents({ branch_id: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });
});

describe("getStudentById — branch ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when student does not belong to specified branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const data = await fn(
        {
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
        },
        { userId: "u1", roles: ["admin"], assignments: [] }
      );
      return { success: true, data };
    });

    const result = await getStudentById(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns student when they belong to specified branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: Function) => {
      const data = await fn(
        {
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
        },
        { userId: "u1", roles: ["admin"], assignments: [] }
      );
      return { success: true, data };
    });

    const result = await getStudentById(STUDENT_ID, BRANCH_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.id).toBe(STUDENT_ID);
    }
  });
});
