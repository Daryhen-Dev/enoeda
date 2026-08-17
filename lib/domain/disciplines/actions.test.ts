/**
 * Branch-security behavioral tests for disciplines domain actions.
 *
 * These tests validate that every branch-operational function:
 * 1. Rejects when branch_id is missing (fail-closed)
 * 2. Rejects when caller lacks assignment to the requested branch
 * 3. Rejects cross-branch access (student/enrollment belongs to different branch)
 * 4. Only succeeds with valid branch context
 *
 * Mocks withAuthenticatedUser to isolate the branch assertion logic
 * without requiring a live database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedContext } from "@/lib/auth/server-context";

// --- Mock setup ---

const BRANCH_A = "a0000000-0000-4000-8000-000000000001";
const BRANCH_B = "a0000000-0000-4000-8000-000000000002";
const STUDENT_ID = "b1111111-1111-4111-8111-111111111111";
const DISCIPLINE_ID = "c2222222-2222-4222-8222-222222222222";
const ENROLLMENT_ID = "d3333333-3333-4333-8333-333333333333";
const USER_ID = "e4444444-4444-4444-8444-444444444444";

const ctxBranchA: AuthenticatedContext = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_A }],
};

const ctxBranchB: AuthenticatedContext = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_B }],
};

const ctxNoAssignment: AuthenticatedContext = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [],
};

// Mock tx builder
function buildMockTx(overrides: Record<string, unknown> = {}) {
  return {
    students: {
      findUnique: vi.fn().mockResolvedValue({ branch_id: BRANCH_A }),
    },
    student_disciplines: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        id: ENROLLMENT_ID,
        is_active: true,
        student_id: STUDENT_ID,
        students: { branch_id: BRANCH_A },
      }),
      create: vi.fn().mockResolvedValue({ id: ENROLLMENT_ID }),
      update: vi.fn().mockResolvedValue({}),
    },
    discipline_events: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    discipline_levels: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    student_progress: {
      create: vi.fn().mockResolvedValue({ id: "progress-1" }),
    },
    disciplines: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

// The mock for withAuthenticatedUser that captures the callback
let mockWithAuth: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => (mockWithAuth as (...a: unknown[]) => unknown)(...args),
}));

// Keep the real branch-assertion module (we want to test its behavior)
vi.mock("@/lib/auth/branch-assertion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/branch-assertion")>(
    "@/lib/auth/branch-assertion"
  );
  return actual;
});

// Import actions under test (after mock setup)
let getStudentDisciplines: typeof import("./actions").getStudentDisciplines;
let getEnrollmentHistory: typeof import("./actions").getEnrollmentHistory;
let enrollStudent: typeof import("./actions").enrollStudent;
let suspendEnrollment: typeof import("./actions").suspendEnrollment;
let reactivateEnrollment: typeof import("./actions").reactivateEnrollment;

beforeEach(async () => {
  vi.resetModules();

  mockWithAuth = vi.fn();

  // Re-mock after resetModules
  vi.doMock("@/lib/auth/server-context", () => ({
    withAuthenticatedUser: (...args: unknown[]) => (mockWithAuth as (...a: unknown[]) => unknown)(...args),
  }));

  const mod = await import("./actions");
  getStudentDisciplines = mod.getStudentDisciplines;
  getEnrollmentHistory = mod.getEnrollmentHistory;
  enrollStudent = mod.enrollStudent;
  suspendEnrollment = mod.suspendEnrollment;
  reactivateEnrollment = mod.reactivateEnrollment;
});

// --- Helper to simulate withAuthenticatedUser execution ---

function setupWithAuth(ctx: AuthenticatedContext, tx?: ReturnType<typeof buildMockTx>) {
  const mockTx = tx ?? buildMockTx();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  mockWithAuth.mockImplementation(async (fn: Function) => {
    const data = await fn(mockTx, ctx);
    return { success: true, data };
  });
  return mockTx;
}

// =============================================================================
// getStudentDisciplines
// =============================================================================

describe("getStudentDisciplines — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await getStudentDisciplines({ student_id: STUDENT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment to the requested branch", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await getStudentDisciplines({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch student access", async () => {
    // Student belongs to BRANCH_A, caller requests BRANCH_B
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await getStudentDisciplines({
      student_id: STUDENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });

  it("succeeds with valid branch context", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([]);
    setupWithAuth(ctxBranchA, tx);

    const result = await getStudentDisciplines({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// getEnrollmentHistory
// =============================================================================

describe("getEnrollmentHistory — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await getEnrollmentHistory({ student_id: STUDENT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects cross-branch student access", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await getEnrollmentHistory({
      student_id: STUDENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});

// =============================================================================
// enrollStudent
// =============================================================================

describe("enrollStudent — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment to the requested branch", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch student enrollment (student belongs to different branch)", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });

  it("succeeds with valid branch context — no write without branch validation", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchA, tx);

    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// suspendEnrollment
// =============================================================================

describe("suspendEnrollment — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await suspendEnrollment({
      student_discipline_id: ENROLLMENT_ID,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await suspendEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch enrollment suspension", async () => {
    const tx = buildMockTx();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue({
      id: ENROLLMENT_ID,
      is_active: true,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchB, tx);

    const result = await suspendEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});

// =============================================================================
// reactivateEnrollment
// =============================================================================

describe("reactivateEnrollment — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await reactivateEnrollment({
      student_discipline_id: ENROLLMENT_ID,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await reactivateEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch enrollment reactivation", async () => {
    const tx = buildMockTx();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue({
      id: ENROLLMENT_ID,
      is_active: false,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchB, tx);

    const result = await reactivateEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});
