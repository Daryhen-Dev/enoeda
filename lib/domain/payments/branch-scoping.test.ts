/**
 * Payment actions branch-scoping tests.
 *
 * Validates that:
 * - registerMonthlyPayment validates the selected period and enforces branch ownership
 * - registerClassPayment requires branch_id and validates caller assignment + enrollment ownership
 * - getStudentPayments requires branch_id and validates caller assignment + student ownership
 * - configureDisciplineClassPrice requires branch_id and validates caller assignment
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

vi.mock("./queries", () => ({
  countOverdueStudents: vi.fn(),
  getMonthlyPaymentSummaryQuery: vi.fn(),
  listOverdueStudents: vi.fn(),
}));

import {
  registerMonthlyPayment,
  registerClassPayment,
  getStudentPayments,
  configureDisciplineClassPrice,
  correctMonthlyPayment,
  correctClassPayment,
  deleteClassPayment,
} from "./actions";
import type {
  RegisterMonthlyPaymentInput,
  RegisterClassPaymentInput,
  GetStudentPaymentsInput,
  ConfigureDisciplineClassPriceInput,
} from "./schema";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const OTHER_BRANCH = "bbbbbbbb-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "cccccccc-1111-4222-a333-444444444444";
const STUDENT_ID = "dddddddd-1111-4222-a333-444444444444";
const DISCIPLINE_ID = "eeeeeeee-1111-4222-a333-444444444444";

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

describe("registerMonthlyPayment — branch context and period contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input (schema level)", async () => {
    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-01",
      period_end: "2025-02-01",
    } as unknown as RegisterMonthlyPaymentInput);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects client-supplied months_covered", async () => {
    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-01",
      period_end: "2025-02-01",
      branch_id: BRANCH_ID,
      months_covered: 12,
    } as unknown as RegisterMonthlyPaymentInput);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment for target branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { student_disciplines: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-01",
      period_end: "2025-02-01",
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch enrollment (student in different branch)", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        student_disciplines: {
          findUnique: vi.fn().mockResolvedValue({
            id: ENROLLMENT_ID,
            students: { branch_id: OTHER_BRANCH },
          }),
          update: vi.fn(),
        },
        payments: { create: vi.fn() },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-01",
      period_end: "2025-02-01",
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("otra sucursal");
  });

  it("rejects an inactive or missing branch before creating a monthly payment", async () => {
    const create = vi.fn();
    const queryRaw = vi.fn().mockResolvedValue([]);
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({
        student_disciplines: {
          findUnique: vi.fn().mockResolvedValue({
            id: ENROLLMENT_ID,
            students: { branch_id: BRANCH_ID },
          }),
        },
        payments: { create, findFirst: vi.fn() },
        $queryRaw: queryRaw,
      }, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-01",
      period_end: "2025-02-01",
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("inactiva");
    expect(create).not.toHaveBeenCalled();
  });

  it("persists the selected period, derived months, and period end as the next due date", async () => {
    const mockPaymentCreate = vi.fn().mockResolvedValue({ id: "pay-1" });
    const findUnique = vi.fn()
      .mockResolvedValueOnce({
        id: ENROLLMENT_ID,
        students: { branch_id: BRANCH_ID },
      })
      .mockResolvedValueOnce({ next_due_date: new Date(2025, 2, 5) });
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        student_disciplines: { findUnique },
        payments: { create: mockPaymentCreate, findFirst: vi.fn().mockResolvedValue(null) },
        $queryRaw: vi.fn().mockResolvedValue([
          { payment_due_day: 5, payment_edit_window_days: 7 },
        ]),
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-31",
      period_end: "2025-03-01",
      payment_date: "2025-01-15",
      branch_id: BRANCH_ID,
    });

    expect(result).toEqual({
      success: true,
      data: { id: "pay-1", next_due_date: "2025-03-05" },
    });
    expect(mockPaymentCreate).toHaveBeenCalledWith({
      data: {
        student_discipline_id: ENROLLMENT_ID,
        amount: 50,
        months_covered: 2,
        period_start: "2025-01-31",
        period_end: "2025-03-01",
        payment_date: "2025-01-15",
        recorded_by: "u1",
        note: null,
      },
      select: { id: true },
    });
    expect(findUnique).toHaveBeenLastCalledWith({
      where: { id: ENROLLMENT_ID },
      select: { next_due_date: true },
    });
  });

  it("rejects a period whose end is not after its start", async () => {
    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-02-01",
      period_end: "2025-02-01",
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects a period that spans more than 24 calendar months", async () => {
    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2025-01-31",
      period_end: "2027-02-01",
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });
});

describe("registerClassPayment — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input", async () => {
    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
    } as unknown as RegisterClassPaymentInput);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { student_disciplines: { findUnique: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("asignación");
  });

  it("rejects cross-branch enrollment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        student_disciplines: {
          findUnique: vi.fn().mockResolvedValue({
            id: ENROLLMENT_ID,
            disciplines: { class_price: 10 },
            students: { branch_id: OTHER_BRANCH },
          }),
        },
        class_payments: { create: vi.fn() },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("otra sucursal");
  });

  it("rejects an inactive or missing branch before creating a class payment", async () => {
    const create = vi.fn();
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({
        student_disciplines: {
          findUnique: vi.fn().mockResolvedValue({
            id: ENROLLMENT_ID,
            disciplines: { class_price: 10 },
            students: { branch_id: BRANCH_ID },
          }),
        },
        class_payments: { create },
        $queryRaw: vi.fn().mockResolvedValue([]),
      }, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("inactiva");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("getStudentPayments — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input", async () => {
    const result = await getStudentPayments({
      student_id: STUDENT_ID,
    } as unknown as GetStudentPaymentsInput);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: { findUnique: vi.fn() },
        payments: { findMany: vi.fn() },
        class_payments: { findMany: vi.fn() },
      };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await getStudentPayments({
      student_id: STUDENT_ID,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("asignación");
  });

  it("rejects when student belongs to a different branch", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        students: {
          findUnique: vi.fn().mockResolvedValue({ branch_id: OTHER_BRANCH }),
        },
        payments: { findMany: vi.fn() },
        class_payments: { findMany: vi.fn() },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await getStudentPayments({
      student_id: STUDENT_ID,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("otra sucursal");
  });
});

describe("configureDisciplineClassPrice — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input", async () => {
    const result = await configureDisciplineClassPrice({
      discipline_id: DISCIPLINE_ID,
      class_price: 10,
    } as unknown as ConfigureDisciplineClassPriceInput);

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects caller without active assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = { disciplines: { update: vi.fn() } };
      const data = await fn(tx, noAssignmentCtx);
      return { success: true, data };
    });

    const result = await configureDisciplineClassPrice({
      discipline_id: DISCIPLINE_ID,
      class_price: 10,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("asignación");
  });

  it("updates a discipline without a student enrollment when the caller has valid branch assignment", async () => {
    const update = vi.fn().mockResolvedValue({ id: DISCIPLINE_ID });
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({ disciplines: { update } }, validAdminCtx);
      return { success: true, data };
    });

    const result = await configureDisciplineClassPrice({
      discipline_id: DISCIPLINE_ID,
      class_price: 10,
      branch_id: BRANCH_ID,
    });

    expect(result).toEqual({ success: true, data: { id: DISCIPLINE_ID } });
    expect(update).toHaveBeenCalledWith({
      where: { id: DISCIPLINE_ID },
      data: { class_price: 10 },
      select: { id: true },
    });
  });
});


describe("payment corrections — branch-admin boundary", () => {
  const paymentId = "ffffffff-1111-4222-a333-444444444444";
  const correctionInput = {
    id: paymentId,
    amount: 50,
    period_start: "2026-04-01",
    period_end: "2026-05-01",
    payment_date: "2026-04-01",
    branch_id: BRANCH_ID,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies a teacher correction before querying payment data", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({}, {
        userId: "teacher-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_ID }],
      });
      return { success: true, data };
    });

    const result = await correctMonthlyPayment(correctionInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("administrador");
  });

  it("denies an owner without a branch-admin assignment", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({}, {
        userId: "owner-1",
        roles: ["owner"],
        assignments: [{ role: "owner", branchId: null }],
      });
      return { success: true, data };
    });

    const result = await deleteClassPayment({ id: paymentId, branch_id: BRANCH_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("administrador");
  });

  it("denies a cross-branch monthly correction before reading branch settings", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: paymentId,
      created_at: new Date("2026-04-01T00:00:00.000Z"),
      student_discipline_id: ENROLLMENT_ID,
      student_disciplines: { students: { branch_id: OTHER_BRANCH } },
    });
    const queryRaw = vi.fn();
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({ payments: { findUnique }, $queryRaw: queryRaw }, validAdminCtx);
      return { success: true, data };
    });

    const result = await correctMonthlyPayment(correctionInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("otra sucursal");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("denies a teacher class-payment correction", async () => {
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const data = await fn({}, {
        userId: "teacher-1",
        roles: ["teacher"],
        assignments: [{ role: "teacher", branchId: BRANCH_ID }],
      });
      return { success: true, data };
    });

    const result = await correctClassPayment({
      id: paymentId,
      amount: 10,
      class_date: "2026-04-01",
      branch_id: BRANCH_ID,
    });
    expect(result.success).toBe(false);
  });
});
