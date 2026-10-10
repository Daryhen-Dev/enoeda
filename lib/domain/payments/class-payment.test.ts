/**
 * T6 — Shared class-payment creation helper and the registerClassPayment
 * one-time-class path.
 *
 * Covers:
 * - createClassPaymentForOccurrence: happy path (scheduled + one-time),
 *   missing class price, cross-branch enrollment, duplicate occurrence
 *   payment mapped to ALREADY_PAID
 * - registerClassPayment: accepts optional one_time_class_id, rejects both
 *   occurrence ids at once
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

import {
  createClassPaymentForOccurrence,
} from "./class-payment";
import { registerClassPayment } from "./actions";
import { PAYMENT_MESSAGES } from "@/lib/localization/es-ec";
import type { TransactionClient } from "@/lib/prisma/client";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-8333-444444444444";
const CLASS_ID = "cccccccc-1111-2222-8333-444444444444";
const ONE_TIME_ID = "8e8e8e8e-1111-2222-8333-444444444444";
const USER_ID = "eeeeeeee-1111-2222-8333-444444444444";
const ENROLLMENT_ID = "22222222-3333-4444-8555-666666666661";
const PAYMENT_ID = "44444444-5555-6666-8777-888888888881";
const CLASS_DATE = new Date("2026-09-10T00:00:00.000Z");

function makeMockTx() {
  return {
    $queryRaw: vi.fn(),
    student_disciplines: {
      findUnique: vi.fn(),
    },
    class_payments: {
      create: vi.fn(),
    },
  };
}

type MockTx = ReturnType<typeof makeMockTx>;

function setupAuth(tx: MockTx) {
  mockWithAuth.mockImplementation(
    async (fn: (tx: MockTx, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: USER_ID,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    }
  );
}

describe("createClassPaymentForOccurrence", () => {
  let tx: MockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeMockTx();
    tx.$queryRaw.mockResolvedValue([
      { payment_due_day: 5, payment_edit_window_days: 3 },
    ]);
    tx.class_payments.create.mockResolvedValue({ id: PAYMENT_ID, amount: 5 });
  });

  it("creates the payment bound to a one-time class occurrence", async () => {
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_A },
    });

    const result = await createClassPaymentForOccurrence({
      tx: tx as unknown as TransactionClient,
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      recorded_by: USER_ID,
      class_date: CLASS_DATE,
      one_time_class_id: ONE_TIME_ID,
    });

    expect(result).toMatchObject({ ok: true, id: PAYMENT_ID, amount: 5 });
    expect(tx.class_payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          student_discipline_id: ENROLLMENT_ID,
          amount: 5,
          class_date: CLASS_DATE,
          scheduled_class_id: null,
          one_time_class_id: ONE_TIME_ID,
        }),
      })
    );
  });

  it("creates the payment bound to a scheduled class occurrence", async () => {
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_A },
    });

    const result = await createClassPaymentForOccurrence({
      tx: tx as unknown as TransactionClient,
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      recorded_by: USER_ID,
      class_date: CLASS_DATE,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toMatchObject({ ok: true, id: PAYMENT_ID });
    expect(tx.class_payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduled_class_id: CLASS_ID,
          one_time_class_id: null,
        }),
      })
    );
  });

  it("fails with CLASS_PRICE_NOT_SET when the discipline has no price", async () => {
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: null },
      students: { branch_id: BRANCH_A },
    });

    const result = await createClassPaymentForOccurrence({
      tx: tx as unknown as TransactionClient,
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      recorded_by: USER_ID,
      class_date: CLASS_DATE,
      one_time_class_id: ONE_TIME_ID,
    });

    expect(result).toEqual({ ok: false, error: PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET });
    expect(tx.class_payments.create).not.toHaveBeenCalled();
  });

  it("rejects an enrollment from another branch", async () => {
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_B },
    });

    const result = await createClassPaymentForOccurrence({
      tx: tx as unknown as TransactionClient,
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      recorded_by: USER_ID,
      class_date: CLASS_DATE,
      one_time_class_id: ONE_TIME_ID,
    });

    expect(result.ok).toBe(false);
    expect(tx.class_payments.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate occurrence payment to ALREADY_PAID", async () => {
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_A },
    });
    tx.class_payments.create.mockRejectedValue(
      new Error(
        "Unique constraint failed on the fields: (`class_payments_scheduled_occurrence_uq`)"
      )
    );

    const result = await createClassPaymentForOccurrence({
      tx: tx as unknown as TransactionClient,
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      recorded_by: USER_ID,
      class_date: CLASS_DATE,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toEqual({ ok: false, error: PAYMENT_MESSAGES.ALREADY_PAID });
  });
});

describe("registerClassPayment with one_time_class_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an input with both occurrence ids at once", async () => {
    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      one_time_class_id: ONE_TIME_ID,
    });

    expect(result.success).toBe(false);
    expect(mockWithAuth).not.toHaveBeenCalled();
  });

  it("accepts an occurrence-scoped one-time class payment", async () => {
    const tx = makeMockTx();
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_A },
    });
    tx.$queryRaw.mockResolvedValue([
      { payment_due_day: 5, payment_edit_window_days: 3 },
    ]);
    tx.class_payments.create.mockResolvedValue({ id: PAYMENT_ID, amount: 5 });
    setupAuth(tx);

    const result = await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      class_date: "2026-09-10",
      one_time_class_id: ONE_TIME_ID,
    });

    expect(result).toEqual({
      success: true,
      data: { id: PAYMENT_ID, amount: 5 },
    });
    expect(tx.class_payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          one_time_class_id: ONE_TIME_ID,
          scheduled_class_id: null,
        }),
      })
    );
  });
});
