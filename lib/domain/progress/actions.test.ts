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
      findMany: vi.fn().mockResolvedValue([]),
    },
    branch_level_requirements: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    attendance: {
      count: vi.fn().mockResolvedValue(12),
      findMany: vi.fn().mockResolvedValue([]),
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
let getStudentProgressSummary: typeof import("./actions").getStudentProgressSummary;
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
  getStudentProgressSummary = mod.getStudentProgressSummary;
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
// Branch level requirement resolution (effective value)
// =============================================================================

describe("getPromotionReadiness — branch level requirement overrides", () => {
  function setupReadinessTx(
    override: { branch_id: string; required_attended_sessions: number } | null
  ) {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    tx.branch_level_requirements.findUnique = vi.fn().mockResolvedValue(override);
    setupWithAuth(ctxBranchA, tx);
    return tx;
  }

  it("uses the branch override when one exists", async () => {
    setupReadinessTx({ branch_id: BRANCH_A, required_attended_sessions: 4 });

    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    expect(result.data?.required).toBe(4);
    expect(result.data?.meets_requirement).toBe(true); // attended = 12
  });

  it("falls back to the general value without an override", async () => {
    setupReadinessTx(null);

    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    expect(result.data?.required).toBe(10);
    expect(result.data?.meets_requirement).toBe(true);
  });

  it("ignores an override that belongs to another branch", async () => {
    setupReadinessTx({ branch_id: BRANCH_B, required_attended_sessions: 99 });

    const result = await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    expect(result.data?.required).toBe(10);
  });

  it("queries the override scoped to the requested branch and level", async () => {
    const tx = setupReadinessTx(null);

    await getPromotionReadiness({
      student_id: STUDENT_ID,
      discipline_id: DISCIPLINE_ID,
      level_id: LEVEL_ID,
      branch_id: BRANCH_A,
    });
    expect(tx.branch_level_requirements.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branch_id_level_id: { branch_id: BRANCH_A, level_id: LEVEL_ID },
        },
      })
    );
  });
});

describe("getStudentProgressSummary — branch level requirement overrides", () => {
  const OTHER_LEVEL_ID = "d3333333-3333-4333-8333-333333333399";

  interface SummaryLevelRow {
    id: string;
    discipline_id: string;
    name: string;
    color: string | null;
    sort_order: number;
    required_attended_sessions: number;
  }

  function setupSummaryTx(options: {
    levels: SummaryLevelRow[];
    progressRecords?: Array<{
      id: string;
      discipline_id: string;
      level_id: string;
      promoted_at: Date;
      created_at: Date;
    }>;
    overrideRows: Array<{
      branch_id: string;
      level_id: string;
      required_attended_sessions: number;
    }>;
  }) {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({
      branch_id: BRANCH_A,
      student_disciplines: [
        { discipline_id: DISCIPLINE_ID, disciplines: { name: "Karate" } },
      ],
    });
    tx.discipline_levels.findMany = vi.fn().mockResolvedValue(options.levels);
    tx.student_progress.findMany = vi
      .fn()
      .mockResolvedValue(options.progressRecords ?? []);
    tx.attendance.findMany = vi.fn().mockResolvedValue([]);
    tx.branch_level_requirements.findMany = vi
      .fn()
      .mockResolvedValue(options.overrideRows);
    setupWithAuth(ctxBranchA, tx);
    return tx;
  }

  function buildLevels(): SummaryLevelRow[] {
    return [
      {
        id: LEVEL_ID,
        discipline_id: DISCIPLINE_ID,
        name: "Blanco",
        color: null,
        sort_order: 0,
        required_attended_sessions: 10,
      },
      {
        id: OTHER_LEVEL_ID,
        discipline_id: DISCIPLINE_ID,
        name: "Amarillo",
        color: null,
        sort_order: 1,
        required_attended_sessions: 20,
      },
    ];
  }

  function buildCurrentProgress() {
    return [
      {
        id: "progress-1",
        discipline_id: DISCIPLINE_ID,
        level_id: LEVEL_ID,
        promoted_at: new Date("2026-01-01"),
        created_at: new Date("2026-01-01"),
      },
    ];
  }

  it("reports the branch override as next_level_required_sessions", async () => {
    setupSummaryTx({
      levels: buildLevels(),
      progressRecords: buildCurrentProgress(),
      overrideRows: [
        {
          branch_id: BRANCH_A,
          level_id: OTHER_LEVEL_ID,
          required_attended_sessions: 5,
        },
      ],
    });

    const result = await getStudentProgressSummary({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    expect(result.data?.[0]?.next_level_id).toBe(OTHER_LEVEL_ID);
    expect(result.data?.[0]?.next_level_required_sessions).toBe(5);
  });

  it("reports the general value when no override exists", async () => {
    setupSummaryTx({
      levels: buildLevels(),
      progressRecords: buildCurrentProgress(),
      overrideRows: [],
    });

    const result = await getStudentProgressSummary({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    expect(result.data?.[0]?.next_level_required_sessions).toBe(20);
  });

  it("ignores override rows belonging to another branch", async () => {
    const tx = setupSummaryTx({
      levels: buildLevels(),
      progressRecords: buildCurrentProgress(),
      overrideRows: [
        {
          branch_id: BRANCH_B,
          level_id: OTHER_LEVEL_ID,
          required_attended_sessions: 99,
        },
      ],
    });

    const result = await getStudentProgressSummary({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
    });
    expect(result.success).toBe(true);
    // A foreign-branch row must never leak into resolution.
    expect(result.data?.[0]?.next_level_required_sessions).toBe(20);
    expect(tx.branch_level_requirements.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branch_id: BRANCH_A } })
    );
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
