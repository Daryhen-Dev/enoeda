/**
 * Payment actions branch-scoping tests.
 *
 * Validates that:
 * - registerMonthlyPayment requires branch_id and validates caller assignment + enrollment ownership
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

describe("registerMonthlyPayment — branch context enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when branch_id is missing from input (schema level)", async () => {
    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      months_covered: 1,
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
      months_covered: 1,
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
            next_due_date: null,
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
      months_covered: 1,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("otra sucursal");
  });

  it("succeeds when branch context, assignment, and ownership all match", async () => {
    const mockPaymentCreate = vi.fn().mockResolvedValue({ id: "pay-1" });
    const mockEnrollUpdate = vi.fn();
    mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const tx = {
        student_disciplines: {
          findUnique: vi.fn().mockResolvedValue({
            id: ENROLLMENT_ID,
            next_due_date: null,
            students: { branch_id: BRANCH_ID },
          }),
          update: mockEnrollUpdate,
        },
        payments: { create: mockPaymentCreate },
      };
      const data = await fn(tx, validAdminCtx);
      return { success: true, data };
    });

    const result = await registerMonthlyPayment({
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      months_covered: 1,
      branch_id: BRANCH_ID,
    });

    expect(result.success).toBe(true);
    expect(mockPaymentCreate).toHaveBeenCalled();
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
