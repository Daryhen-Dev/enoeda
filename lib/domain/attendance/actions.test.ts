/**
 * Attendance action boundary tests — branch context validation.
 *
 * Validates that takeAttendance, getAttendanceForSession, and getAttendanceStats
 * require branch_id, schema-validate it, and reject missing/invalid/cross-branch
 * input before performing any read/write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock withAuthenticatedUser to track if DB reads/writes happen
const mockTxCalls: string[] = [];
const mockWithAuthenticatedUser = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

vi.mock("@/lib/auth/branch-assertion", async () => {
  const actual = await vi.importActual("@/lib/auth/branch-assertion");
  return actual;
});

import { takeAttendance, getAttendanceForSession, getAttendanceStats } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";
const CLASS_ID = "cccccccc-1111-2222-3333-444444444444";
const STUDENT_ID = "dddddddd-1111-2222-3333-444444444444";

function makeMockTx() {
  mockTxCalls.length = 0;
  return new Proxy({}, {
    get(_target, prop) {
      return new Proxy({}, {
        get(_t2, method) {
          return (..._args: unknown[]) => {
            mockTxCalls.push(`${String(prop)}.${String(method)}`);
            return null;
          };
        },
      });
    },
  });
}

describe("takeAttendance branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxCalls.length = 0;
  });

  it("rejects when branch_id is missing from input (schema validation)", async () => {
    // Simulate: if withAuthenticatedUser is reached, it would succeed (bad)
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await takeAttendance({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as any);

    expect(result.success).toBe(false);
    // Schema must reject before withAuthenticatedUser when branch_id is missing
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when branch_id is not a valid UUID (schema validation)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await takeAttendance({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
      branch_id: "not-a-uuid",
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as any);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when caller has no active assignment for the branch (no DB read/write)", async () => {
    const tx = makeMockTx();
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_B }],
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await takeAttendance({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
      branch_id: BRANCH_A,
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as any);

    expect(result.success).toBe(false);
    // No DB reads should have occurred
    expect(mockTxCalls).toHaveLength(0);
  });
});

describe("getAttendanceForSession branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxCalls.length = 0;
  });

  it("rejects when branch_id is missing from input (schema validation)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceForSession({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
    } as any);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when branch_id is not a valid UUID (schema validation)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceForSession({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
      branch_id: "not-valid",
    } as any);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when caller has no assignment for the branch (no DB read)", async () => {
    const tx = makeMockTx();
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_B }],
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceForSession({
      scheduled_class_id: CLASS_ID,
      session_date: "2024-06-10",
      branch_id: BRANCH_A,
    } as any);

    expect(result.success).toBe(false);
    expect(mockTxCalls).toHaveLength(0);
  });
});

describe("getAttendanceStats branch boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxCalls.length = 0;
  });

  it("rejects when branch_id is missing from input (schema validation)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceStats({
      student_id: STUDENT_ID,
    } as any);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when branch_id is not a valid UUID (schema validation)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const tx = makeMockTx();
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceStats({
      student_id: STUDENT_ID,
      branch_id: "invalid",
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects when caller has no active assignment for the branch (no DB read)", async () => {
    const tx = makeMockTx();
    mockWithAuthenticatedUser.mockImplementation(async (fn: any) => {
      const ctx = {
        userId: "user-1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_B }],
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    });

    const result = await getAttendanceStats({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(false);
    expect(mockTxCalls).toHaveLength(0);
  });
});
