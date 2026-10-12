/**
 * Branch-security and lifecycle behavioral tests for the conduct domain.
 *
 * These tests validate that every staff function:
 * 1. Rejects when branch_id is missing (fail-closed)
 * 2. Rejects when caller lacks assignment to the requested branch
 * 3. Rejects cross-branch access (student/record belongs to another branch)
 * 4. Only succeeds with valid branch context
 *
 * Plus: fine/warning lifecycle state rules and the student self-read path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedContext } from "@/lib/auth/server-context";

// --- Mock setup ---

const BRANCH_A = "a0000000-0000-4000-8000-000000000001";
const BRANCH_B = "a0000000-0000-4000-8000-000000000002";
const STUDENT_ID = "b1111111-1111-4111-8111-111111111111";
const RECORD_ID = "e5555555-5555-4555-8555-555555555555";
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

const ctxTeacherBranchA: AuthenticatedContext = {
  userId: USER_ID,
  roles: ["teacher"],
  assignments: [{ role: "teacher", branchId: BRANCH_A }],
};

function buildMockTx(overrides: Record<string, unknown> = {}) {
  return {
    students: {
      findUnique: vi.fn().mockResolvedValue({ branch_id: BRANCH_A }),
    },
    student_conduct_records: {
      findUnique: vi.fn().mockResolvedValue({
        id: RECORD_ID,
        kind: "fine",
        status: "pending",
        voided_at: null,
        student_id: STUDENT_ID,
        students: { branch_id: BRANCH_A },
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: RECORD_ID }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

let mockWithAuth: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    (mockWithAuth as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/lib/auth/branch-assertion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/branch-assertion")>(
    "@/lib/auth/branch-assertion"
  );
  return actual;
});

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getStudentIdentity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/student-identity-resolver", () => ({
  STUDENT_IDENTITY_REASONS: {
    NO_STUDENT: "no_student",
    UNAUTHENTICATED: "unauthenticated",
  },
  getStudentIdentity: mocks.getStudentIdentity,
}));

let createConductRecord: typeof import("./actions").createConductRecord;
let markFinePaid: typeof import("./actions").markFinePaid;
let voidConductRecord: typeof import("./actions").voidConductRecord;
let listStudentConductRecords: typeof import("./actions").listStudentConductRecords;
let getOwnConductRecords: typeof import("./actions").getOwnConductRecords;

beforeEach(async () => {
  vi.resetModules();
  mockWithAuth = vi.fn();

  vi.doMock("@/lib/auth/server-context", () => ({
    withAuthenticatedUser: (...args: unknown[]) =>
      (mockWithAuth as (...a: unknown[]) => unknown)(...args),
  }));

  const mod = await import("./actions");
  createConductRecord = mod.createConductRecord;
  markFinePaid = mod.markFinePaid;
  voidConductRecord = mod.voidConductRecord;
  listStudentConductRecords = mod.listStudentConductRecords;
  getOwnConductRecords = mod.getOwnConductRecords;
});

function setupWithAuth(
  ctx: AuthenticatedContext,
  tx?: ReturnType<typeof buildMockTx>
) {
  const mockTx = tx ?? buildMockTx();
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: unknown, ctx: unknown) => Promise<unknown>,
      options?: { mapTransactionError?: (error: unknown) => string | undefined }
    ) => {
      try {
        const data = await fn(mockTx, ctx);
        return { success: true, data };
      } catch (error) {
        const mapped = options?.mapTransactionError?.(error);
        return { success: false, error: mapped ?? "Ocurrió un error inesperado." };
      }
    }
  );
  return mockTx;
}

// =============================================================================
// createConductRecord
// =============================================================================

describe("createConductRecord — branch security", () => {
  const fineInput = {
    student_id: STUDENT_ID,
    branch_id: BRANCH_A,
    kind: "fine" as const,
    reason: "Daño al equipo",
    amount: 10,
  };

  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await createConductRecord({
      student_id: STUDENT_ID,
      kind: "fine",
      reason: "Daño al equipo",
      amount: 10,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await createConductRecord(fineInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch creation (no write performed)", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await createConductRecord({
      ...fineInput,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_conduct_records.create).not.toHaveBeenCalled();
  });

  it("creates a pending fine attributed to the caller", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxTeacherBranchA, tx);

    const result = await createConductRecord(fineInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(RECORD_ID);
    expect(tx.student_conduct_records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "fine",
          status: "pending",
          created_by: USER_ID,
          amount: 10,
        }),
      })
    );
  });

  it("creates an issued warning without amount", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxBranchA, tx);

    const result = await createConductRecord({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
      kind: "warning",
      reason: "Interrumpió la clase",
    });
    expect(result.success).toBe(true);
    expect(tx.student_conduct_records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "warning",
          status: "issued",
          amount: null,
          created_by: USER_ID,
        }),
      })
    );
  });

  it("defaults the incident date to today when omitted", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxBranchA, tx);

    await createConductRecord({
      student_id: STUDENT_ID,
      branch_id: BRANCH_A,
      kind: "warning",
      reason: "Interrumpió la clase",
    });
    const call = tx.student_conduct_records.create.mock.calls[0][0] as {
      data: { incident_date: Date };
    };
    const expected = new Date();
    expect(call.data.incident_date.getFullYear()).toBe(expected.getFullYear());
    expect(call.data.incident_date.getMonth()).toBe(expected.getMonth());
    expect(call.data.incident_date.getDate()).toBe(expected.getDate());
  });

  it("maps a concurrent trigger violation to a friendly conflict message", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.update = vi
      .fn()
      .mockRejectedValue(
        new Error("voided conduct records cannot be paid")
      );
    setupWithAuth(ctxBranchA, tx);

    const result = await markFinePaid({ id: RECORD_ID, branch_id: BRANCH_A });
    expect(result.success).toBe(false);
    expect(result.error).toBe("El registro cambió de estado. Actualice e inténtelo nuevamente.");
  });
});

// =============================================================================
// markFinePaid
// =============================================================================

describe("markFinePaid — branch security and lifecycle", () => {
  const actionInput = { id: RECORD_ID, branch_id: BRANCH_A };

  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await markFinePaid({ id: RECORD_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch payment (no write performed)", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxBranchB, tx);

    const result = await markFinePaid({ id: RECORD_ID, branch_id: BRANCH_B });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown record", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue(null);
    setupWithAuth(ctxBranchA, tx);

    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects paying a warning", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue({
      id: RECORD_ID,
      kind: "warning",
      status: "issued",
      voided_at: null,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchA, tx);

    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects paying an already paid fine", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue({
      id: RECORD_ID,
      kind: "fine",
      status: "paid",
      voided_at: null,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchA, tx);

    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects paying a voided fine", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue({
      id: RECORD_ID,
      kind: "fine",
      status: "pending",
      voided_at: new Date(),
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchA, tx);

    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("marks a pending fine as paid with caller attribution", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxTeacherBranchA, tx);

    const result = await markFinePaid(actionInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(RECORD_ID);
    expect(tx.student_conduct_records.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RECORD_ID },
        data: expect.objectContaining({
          status: "paid",
          paid_by: USER_ID,
        }),
      })
    );
  });
});

// =============================================================================
// voidConductRecord
// =============================================================================

describe("voidConductRecord — branch security and lifecycle", () => {
  const actionInput = {
    id: RECORD_ID,
    branch_id: BRANCH_A,
    void_reason: "Error de registro",
  };

  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await voidConductRecord({ id: RECORD_ID, void_reason: "x" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when caller has no assignment", async () => {
    setupWithAuth(ctxNoAssignment);
    const result = await voidConductRecord(actionInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch void (no write performed)", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxBranchB, tx);

    const result = await voidConductRecord({
      ...actionInput,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects an already voided record", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue({
      id: RECORD_ID,
      kind: "warning",
      status: "issued",
      voided_at: new Date(),
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchA, tx);

    const result = await voidConductRecord(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("rejects voiding a paid fine", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findUnique = vi.fn().mockResolvedValue({
      id: RECORD_ID,
      kind: "fine",
      status: "paid",
      voided_at: null,
      student_id: STUDENT_ID,
      students: { branch_id: BRANCH_A },
    });
    setupWithAuth(ctxBranchA, tx);

    const result = await voidConductRecord(actionInput);
    expect(result.success).toBe(false);
    expect(tx.student_conduct_records.update).not.toHaveBeenCalled();
  });

  it("voids a pending fine with actor attribution", async () => {
    const tx = buildMockTx();
    setupWithAuth(ctxBranchA, tx);

    const result = await voidConductRecord(actionInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(RECORD_ID);
    expect(tx.student_conduct_records.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RECORD_ID },
        data: expect.objectContaining({
          voided_by: USER_ID,
          void_reason: "Error de registro",
        }),
      })
    );
  });
});

// =============================================================================
// listStudentConductRecords
// =============================================================================

describe("listStudentConductRecords — branch security and summary", () => {
  const queryInput = { student_id: STUDENT_ID, branch_id: BRANCH_A };

  it("rejects when branch_id is missing", async () => {
    setupWithAuth(ctxBranchA);
    // @ts-expect-error intentionally omitting branch_id to test schema rejection
    const result = await listStudentConductRecords({ student_id: STUDENT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects cross-branch listing", async () => {
    const tx = buildMockTx();
    tx.students.findUnique = vi.fn().mockResolvedValue({ branch_id: BRANCH_A });
    setupWithAuth(ctxBranchB, tx);

    const result = await listStudentConductRecords({
      student_id: STUDENT_ID,
      branch_id: BRANCH_B,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("otra sucursal");
  });

  it("summarizes pending fines and warnings excluding voided records", async () => {
    const tx = buildMockTx();
    tx.student_conduct_records.findMany = vi.fn().mockResolvedValue([
      {
        id: "r1",
        student_id: STUDENT_ID,
        kind: "fine",
        reason: "a",
        incident_date: new Date("2026-09-01"),
        amount: "25.50",
        status: "pending",
        paid_at: null,
        paid_by: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_by: USER_ID,
        created_at: new Date("2026-09-01T10:00:00Z"),
        updated_at: new Date("2026-09-01T10:00:00Z"),
      },
      {
        id: "r2",
        student_id: STUDENT_ID,
        kind: "fine",
        reason: "b",
        incident_date: new Date("2026-09-02"),
        amount: "10.00",
        status: "pending",
        paid_at: null,
        paid_by: null,
        voided_at: new Date("2026-09-03"),
        voided_by: USER_ID,
        void_reason: "duplicado",
        created_by: USER_ID,
        created_at: new Date("2026-09-02T10:00:00Z"),
        updated_at: new Date("2026-09-03T10:00:00Z"),
      },
      {
        id: "r3",
        student_id: STUDENT_ID,
        kind: "warning",
        reason: "c",
        incident_date: new Date("2026-09-02"),
        amount: null,
        status: "issued",
        paid_at: null,
        paid_by: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_by: USER_ID,
        created_at: new Date("2026-09-02T11:00:00Z"),
        updated_at: new Date("2026-09-02T11:00:00Z"),
      },
      {
        id: "r4",
        student_id: STUDENT_ID,
        kind: "warning",
        reason: "d",
        incident_date: new Date("2026-09-03"),
        amount: null,
        status: "issued",
        paid_at: null,
        paid_by: null,
        voided_at: new Date("2026-09-04"),
        voided_by: USER_ID,
        void_reason: "error",
        created_by: USER_ID,
        created_at: new Date("2026-09-03T11:00:00Z"),
        updated_at: new Date("2026-09-04T11:00:00Z"),
      },
    ]);
    setupWithAuth(ctxBranchA, tx);

    const result = await listStudentConductRecords(queryInput);
    expect(result.success).toBe(true);
    expect(result.data?.records).toHaveLength(4);
    expect(result.data?.summary).toEqual({
      pending_fines_count: 1,
      pending_fines_total: 25.5,
      warnings_count: 1,
    });
    // Staff list keeps voided records flagged as such.
    expect(result.data?.records.find((r) => r.id === "r2")?.voided_at).not.toBeNull();
  });
});

// =============================================================================
// getOwnConductRecords (student portal)
// =============================================================================

describe("getOwnConductRecords — student self-read", () => {
  function setupSupabaseRows(rows: unknown[] | null, error: unknown = null) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => chain) });
    return chain;
  }

  const studentIdentity = {
    ok: true as const,
    student: {
      activationStatus: "active" as const,
      authUserId: USER_ID,
      dateOfBirth: "2000-01-01",
      email: "student@example.com",
      firstName: "Ana",
      id: STUDENT_ID,
      isActive: true,
      nationalId: "1712345678",
      phone: null,
      surname: "Pérez",
    },
  };

  it("requires a linked student profile", async () => {
    mocks.getStudentIdentity.mockResolvedValue({ ok: false, reason: "no_student" });
    const result = await getOwnConductRecords();
    expect(result.success).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });
    const result = await getOwnConductRecords();
    expect(result.success).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("maps a query error to the unexpected-error message", async () => {
    mocks.getStudentIdentity.mockResolvedValue(studentIdentity);
    setupSupabaseRows(null, { message: "RLS denial" });

    const result = await getOwnConductRecords();
    expect(result.success).toBe(false);
  });

  it("returns own non-voided records through the RLS-bound self query", async () => {
    mocks.getStudentIdentity.mockResolvedValue(studentIdentity);
    const chain = setupSupabaseRows([
      {
        id: "r1",
        student_id: STUDENT_ID,
        kind: "fine",
        reason: "a",
        incident_date: "2026-09-01",
        amount: 25.5,
        status: "pending",
        paid_at: null,
        paid_by: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_by: USER_ID,
        created_at: "2026-09-01T10:00:00Z",
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "r2",
        student_id: STUDENT_ID,
        kind: "warning",
        reason: "c",
        incident_date: "2026-09-02",
        amount: null,
        status: "issued",
        paid_at: null,
        paid_by: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_by: USER_ID,
        created_at: "2026-09-02T11:00:00Z",
        updated_at: "2026-09-02T11:00:00Z",
      },
    ]);

    const result = await getOwnConductRecords();
    expect(result.success).toBe(true);
    expect(chain.eq).toHaveBeenCalledWith("student_id", STUDENT_ID);
    // Voided records are excluded from the student view.
    expect(chain.is).toHaveBeenCalledWith("voided_at", null);
    expect(result.data?.records).toHaveLength(2);
    expect(result.data?.records[0]?.amount).toBe(25.5);
    expect(result.data?.summary).toEqual({
      pending_fines_count: 1,
      pending_fines_total: 25.5,
      warnings_count: 1,
    });
  });
});
