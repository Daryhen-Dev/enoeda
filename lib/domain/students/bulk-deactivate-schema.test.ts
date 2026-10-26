/**
 * S4 bulk deactivation — schema and all-or-nothing action contract.
 * Mocked boundary: no DB, no auth runtime.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const OTHER_BRANCH_ID = "bbbbbbbb-2222-4222-8333-444444444445";
const STUDENT_A = "cccccccc-1111-4222-8333-444444444441";
const STUDENT_B = "cccccccc-2222-4222-8333-444444444442";

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    mockWithAuthenticatedUser(...args),
}));

import { BRANCH_ASSERTION_MESSAGES } from "@/lib/auth/branch-assertion";
import {
  STUDENT_BULK_ACTIONS_MESSAGES,
  STUDENT_MESSAGES,
} from "@/lib/localization/es-ec";

import { deactivateStudents } from "./actions";
import {
  STUDENT_BULK_DEACTIVATE_LIMIT,
  studentBulkDeactivateSchema,
} from "./schema";

const VALID_BATCH = {
  student_ids: [STUDENT_A, STUDENT_B],
  branch_id: BRANCH_ID,
};

const ADMIN_CTX = {
  userId: "u1",
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_ID }],
};

const OTHER_BRANCH_CTX = {
  userId: "u1",
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: OTHER_BRANCH_ID }],
};

const mockTx = {
  students: { findMany: mockFindMany, updateMany: mockUpdateMany },
};

function useCallerContext(ctx: typeof ADMIN_CTX) {
  mockWithAuthenticatedUser.mockImplementation(
    async (fn: (tx: unknown, ctx: typeof ADMIN_CTX) => Promise<unknown>) => {
      const data = await fn(mockTx, ctx);
      return { success: true, data };
    }
  );
}

describe("studentBulkDeactivateSchema", () => {
  it("accepts a valid batch and keeps every selected id", () => {
    const parsed = studentBulkDeactivateSchema.safeParse(VALID_BATCH);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.student_ids).toEqual([STUDENT_A, STUDENT_B]);
      expect(parsed.data.branch_id).toBe(BRANCH_ID);
    }
  });

  it("accepts the maximum batch size", () => {
    const studentIds = Array.from(
      { length: STUDENT_BULK_DEACTIVATE_LIMIT },
      (_value, index) =>
        `cccccccc-1111-4222-8333-${String(index).padStart(12, "0")}`
    );

    expect(
      studentBulkDeactivateSchema.safeParse({
        student_ids: studentIds,
        branch_id: BRANCH_ID,
      }).success
    ).toBe(true);
  });

  it("rejects an empty selection", () => {
    const parsed = studentBulkDeactivateSchema.safeParse({
      ...VALID_BATCH,
      student_ids: [],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        STUDENT_BULK_ACTIONS_MESSAGES.SELECTION_REQUIRED
      );
    }
  });

  it("rejects a selection above the batch limit", () => {
    const studentIds = Array.from(
      { length: STUDENT_BULK_DEACTIVATE_LIMIT + 1 },
      (_value, index) =>
        `cccccccc-1111-4222-8333-${String(index).padStart(12, "0")}`
    );

    const parsed = studentBulkDeactivateSchema.safeParse({
      student_ids: studentIds,
      branch_id: BRANCH_ID,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        STUDENT_BULK_ACTIONS_MESSAGES.SELECTION_LIMIT(
          STUDENT_BULK_DEACTIVATE_LIMIT
        )
      );
    }
  });

  it("rejects a non-uuid student id", () => {
    const parsed = studentBulkDeactivateSchema.safeParse({
      ...VALID_BATCH,
      student_ids: [STUDENT_A, "not-a-uuid"],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        STUDENT_MESSAGES.INVALID_ID
      );
    }
  });

  it("rejects a non-uuid branch", () => {
    const parsed = studentBulkDeactivateSchema.safeParse({
      ...VALID_BATCH,
      branch_id: "sucursal",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        STUDENT_MESSAGES.INVALID_BRANCH_ID
      );
    }
  });

  it("rejects unknown keys", () => {
    const parsed = studentBulkDeactivateSchema.safeParse({
      ...VALID_BATCH,
      reason: "duplicado",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("deactivateStudents — all-or-nothing batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCallerContext(ADMIN_CTX);
    mockFindMany.mockResolvedValue([
      { id: STUDENT_A, first_name: "Ana", surname: "Torres", is_active: true },
      { id: STUDENT_B, first_name: "Bruno", surname: "Vega", is_active: true },
    ]);
    mockUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("deactivates every selected student in one statement inside one transaction", async () => {
    const result = await deactivateStudents(VALID_BATCH);

    expect(result).toEqual({ success: true, data: { deactivated: 2 } });
    expect(mockWithAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [STUDENT_A, STUDENT_B] },
        branch_id: BRANCH_ID,
        is_active: true,
      },
      data: { is_active: false },
    });
  });

  it("changes nothing when a selected student does not belong to the branch", async () => {
    mockFindMany.mockResolvedValue([
      { id: STUDENT_A, first_name: "Ana", surname: "Torres", is_active: true },
    ]);

    const result = await deactivateStudents(VALID_BATCH);

    expect(result).toEqual({
      success: false,
      error: STUDENT_BULK_ACTIONS_MESSAGES.MISSING_SELECTION,
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("changes nothing and names the problem when a selected student is not active", async () => {
    mockFindMany.mockResolvedValue([
      { id: STUDENT_A, first_name: "Ana", surname: "Torres", is_active: true },
      { id: STUDENT_B, first_name: "Bruno", surname: "Vega", is_active: false },
    ]);

    const result = await deactivateStudents(VALID_BATCH);

    expect(result).toEqual({
      success: false,
      error: STUDENT_BULK_ACTIONS_MESSAGES.INACTIVE_SELECTION("Bruno Vega"),
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a caller without an active assignment in the branch", async () => {
    useCallerContext(OTHER_BRANCH_CTX);

    const result = await deactivateStudents(VALID_BATCH);

    expect(result).toEqual({
      success: false,
      error: BRANCH_ASSERTION_MESSAGES.CALLER_NOT_ASSIGNED,
    });
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const result = await deactivateStudents({
      student_ids: [],
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
