/**
 * Per-class enrollments must never receive monthly payments (T8):
 * registerMonthlyPayment and correctMonthlyPayment reject them with
 * PAYMENT_MESSAGES.MONTHLY_NOT_ALLOWED_FOR_PER_CLASS and write nothing.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PAYMENT_MESSAGES } from "@/lib/localization/es-ec";

vi.mock("server-only", () => ({}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

const mockGetBranchPaymentSettings = vi.fn();
vi.mock("./class-payment", () => ({
  getBranchPaymentSettings: (...args: unknown[]) =>
    mockGetBranchPaymentSettings(...args),
}));

import {
  correctMonthlyPayment,
  registerMonthlyPayment,
} from "./actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "cccccccc-1111-4222-a333-444444444444";
const PAYMENT_ID = "dddddddd-1111-4222-a333-444444444444";
const USER_ID = "eeeeeeee-1111-4222-a333-444444444444";

function setupAuth() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([
      { payment_due_day: 5, payment_edit_window_days: 7 },
    ]),
    student_disciplines: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payments: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: unknown, ctx: unknown) => Promise<unknown>,
      options?: { mapTransactionError?: (error: unknown) => string | undefined }
    ) => {
      const ctx = {
        userId: USER_ID,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      try {
        const data = await fn(tx, ctx);
        return { success: true, data };
      } catch (error) {
        const mapped = options?.mapTransactionError?.(error);
        return {
          success: false,
          error: mapped ?? "Ocurrió un error inesperado.",
        };
      }
    }
  );
  return { tx };
}

describe("registerMonthlyPayment — per_class rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBranchPaymentSettings.mockResolvedValue({
      payment_due_day: 5,
      payment_edit_window_days: 7,
      payment_grace_days: 0,
    });
  });

  it("rejects a per_class enrollment with MONTHLY_NOT_ALLOWED_FOR_PER_CLASS", async () => {
    const harness = setupAuth();
    harness.tx.student_disciplines.findUnique = vi.fn().mockResolvedValue({
      id: ENROLLMENT_ID,
      billing_mode: "per_class",
      students: { branch_id: BRANCH_A },
    });

    const result = await registerMonthlyPayment({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2026-10-01",
      period_end: "2026-10-31",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toBe(
      PAYMENT_MESSAGES.MONTHLY_NOT_ALLOWED_FOR_PER_CLASS
    );
    expect(harness.tx.payments.create).not.toHaveBeenCalled();
  });

  it("does not reach the branch settings lookup before the mode check", async () => {
    setupAuth();

    await registerMonthlyPayment({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      amount: 50,
      period_start: "2026-10-01",
      period_end: "2026-10-31",
    });

    expect(mockGetBranchPaymentSettings).not.toHaveBeenCalled();
  });
});

describe("correctMonthlyPayment — per_class rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBranchPaymentSettings.mockResolvedValue({
      payment_due_day: 5,
      payment_edit_window_days: 7,
      payment_grace_days: 0,
    });
  });

  it("rejects a correction on a per_class enrollment", async () => {
    const harness = setupAuth();
    harness.tx.payments.findUnique = vi.fn().mockResolvedValue({
      id: PAYMENT_ID,
      created_at: new Date(),
      student_discipline_id: ENROLLMENT_ID,
      student_disciplines: { students: { branch_id: BRANCH_A } },
    });
    harness.tx.student_disciplines.findUnique = vi.fn().mockResolvedValue({
      billing_mode: "per_class",
      next_due_date: null,
    });

    const result = await correctMonthlyPayment({
      branch_id: BRANCH_A,
      id: PAYMENT_ID,
      amount: 50,
      period_start: "2026-10-01",
      period_end: "2026-10-31",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toBe(
      PAYMENT_MESSAGES.MONTHLY_NOT_ALLOWED_FOR_PER_CLASS
    );
    expect(harness.tx.payments.update).not.toHaveBeenCalled();
  });
});
