/**
 * Branch-security behavioral tests for progress domain actions.
 *
 * These tests validate that every branch-operational function:
 * 1. Rejects when branch_id is missing (fail-closed)
 * 2. Rejects when caller lacks assignment to the requested branch
 * 3. Rejects cross-branch access (student/note belongs to different branch)
 * 4. Only succeeds with valid branch context
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedContext } from "@/lib/auth/server-context";

// --- Mock setup ---

const BRANCH_A = "a0000000-0000-4000-8000-000000000001";
const BRANCH_B = "a0000000-0000-4000-8000-000000000002";
const STUDENT_ID = "b1111111-1111-4111-8111-111111111111";
const DISCIPLINE_ID = "c2222222-2222-4222-8222-222222222222";
const LEVEL_ID = "d3333333-3333-4333-8333-333333333333";
const NOTE_ID = "e5555555-5555-4555-8555-555555555555";
const USER_ID = "f4444444-4444-4444-8444-444444444444";

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

function buildMockTx(overrides: Record<string, unknown> = {}) {
  return {
    students: {
      findUnique: vi.fn().mockResolvedValue({ branch_id: BRANCH_A }),
    },
    student_progress: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "progress-1" }),
    },
    student_notes: {
      findUnique: vi.fn().mockResolvedValue({
        id: NOTE_ID,
        is_completed: false,
        student_id: STUDENT_ID,
        students: { branch_id: BRANCH_A },
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: NOTE_ID }),
      update: vi.fn().mockResolvedValue({}),
    },
    discipline_levels: {
      findUnique: vi.fn().mockResolvedValue({
        discipline_id: DISCIPLINE_ID,
        required_attended_sessions: 10,
      }),
    },
    attendance: {
      count: vi.fn().mockResolvedValue(12),
    },
    ...overrides,
  };
}

let mockWithAuth: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => (mockWithAuth as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/lib/auth/branch-assertion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/branch-assertion")>(
    "@/lib/auth/branch-assertion"
  );
  return actual;
});

let getPromotionReadiness: typeof import("./actions").getPromotionReadiness;
let promoteStudent: typeof import("./actions").promoteStudent;
let listProgress: typeof import("./actions").listProgress;
let createNote: typeof import("./actions").createNote;
let completeNote: typeof import("./actions").completeNote;
let reopenNote: typeof import("./actions").reopenNote;
let listNotes: typeof import("./actions").listNotes;

beforeEach(async () => {
  vi.resetModules();
  mockWithAuth = vi.fn();

  vi.doMock("@/lib/auth/server-context", () => ({
    withAuthenticatedUser: (...args: unknown[]) => (mockWithAuth as (...a: unknown[]) => unknown)(...args),
  }));

  const mod = await import("./actions");
  getPromotionReadiness = mod.getPromotionReadiness;
  promoteStudent = mod.promoteStudent;
  listProgress = mod.listProgress;
  createNote = mod.createNote;
  completeNote = mod.completeNote;
  reopenNote = mod.reopenNote;
  listNotes = mod.listNotes;
});

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
// getPromotionReadiness
// =============================================================================

describe("getPromotionReadiness — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch student readiness check", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});

// =============================================================================
// promoteStudent
// =============================================================================

describe("promoteStudent — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await promoteStudent({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await promoteStudent({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch promotion (no write performed)", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await promoteStudent({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    // Confirm no write was performed
    expect(tx.student_progress.create).not.toHaveBeenCalled();
  });

  it("succeeds with valid branch context", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchA, tx);

    const result = await promoteStudent({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// listProgress
// =============================================================================

describe("listProgress — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await listProgress({ student_id: STUDENT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects cross-branch progress listing", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await listProgress({
      student_id: STUDENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});

// =============================================================================
// createNote
// =============================================================================

describe("createNote — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await createNote({
      student_id: STUDENT_ID,
      category: "general",
      content: "Test note",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await createNote({
      student_id: STUDENT_ID,
      category: "general",
      content: "Test note",
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch note creation (no write performed)", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await createNote({
      student_id: STUDENT_ID,
      category: "general",
      content: "Test note",
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_notes.create).not.toHaveBeenCalled();
  });
});

// =============================================================================
// completeNote
// =============================================================================

describe("completeNote — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await completeNote({ id: NOTE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await completeNote({ id: NOTE_ID, branch_id: BRANCH_A });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch note completion (no write performed)", async () => {
    const tx = buildMockTx();
    tx.student_notes.findUnique = vi.fn().mockResolvedValue({
      id: NOTE_ID,
      is_completed: false,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchB, tx);

    const result = await completeNote({ id: NOTE_ID, branch_id: BRANCH_B });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_notes.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// reopenNote
// =============================================================================

describe("reopenNote — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await reopenNote({ id: NOTE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await reopenNote({ id: NOTE_ID, branch_id: BRANCH_A });
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch note reopening (no write performed)", async () => {
    const tx = buildMockTx();
    tx.student_notes.findUnique = vi.fn().mockResolvedValue({
      id: NOTE_ID,
      is_completed: true,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchB, tx);

    const result = await reopenNote({ id: NOTE_ID, branch_id: BRANCH_B });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_notes.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// listNotes
// =============================================================================

describe("listNotes — branch security", () => {
  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await listNotes({ student_id: STUDENT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects cross-branch notes listing", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await listNotes({
      student_id: STUDENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });
});
