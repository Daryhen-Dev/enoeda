/**
 * Monthly payment periods reach Prisma as dates, never as strings.
 *
 * period_start / period_end are Postgres `date` columns. Passing the raw
 * "YYYY-MM-DD" string from the form into a Prisma filter is rejected with
 * "Invalid value for argument `lt`: premature end of input. Expected ISO-8601
 * DateTime", so EVERY monthly payment failed with "Ocurrió un error
 * inesperado" — found by registering a real payment in the app. The values
 * must be converted to the UTC-midnight instant Postgres `date` columns use.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { registerMonthlyPayment } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "cccccccc-1111-4222-a333-444444444444";
const PAYMENT_ID = "dddddddd-1111-4222-a333-444444444444";
const USER_ID = "eeeeeeee-1111-4222-a333-444444444444";

function setupMonthlyEnrollment() {
  const tx = {
    student_disciplines: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          id: ENROLLMENT_ID,
          billing_mode: "monthly",
          students: { branch_id: BRANCH_A },
        })
        .mockResolvedValueOnce({ next_due_date: new Date("2026-12-05T00:00:00Z") }),
    },
    payments: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: PAYMENT_ID }),
    },
  };
  mockWithAuth.mockImplementation(
    async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: USER_ID,
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      return { success: true, data: await fn(tx, ctx) };
    }
  );
  mockGetBranchPaymentSettings.mockResolvedValue({
    payment_due_day: 5,
    payment_edit_window_days: 7,
  });
  return { tx };
}

const INPUT = {
  student_discipline_id: ENROLLMENT_ID,
  amount: 40,
  period_start: "2026-10-01",
  period_end: "2026-11-01",
  payment_date: "2026-10-26",
  branch_id: BRANCH_A,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerMonthlyPayment period dates", () => {
  it("filters the overlap check with Date instants, not strings", async () => {
    const { tx } = setupMonthlyEnrollment();

    await registerMonthlyPayment(INPUT);

    const where = tx.payments.findFirst.mock.calls[0][0].where;
    expect(where.period_start.lt).toBeInstanceOf(Date);
    expect(where.period_end.gt).toBeInstanceOf(Date);
    expect(where.period_start.lt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(where.period_end.gt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("writes every date column as a UTC-midnight instant", async () => {
    const { tx } = setupMonthlyEnrollment();

    await registerMonthlyPayment(INPUT);

    const data = tx.payments.create.mock.calls[0][0].data;
    expect(data.period_start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(data.period_end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(data.payment_date.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(data.months_covered).toBe(1);
  });

  it("returns the reconciled due date after a successful payment", async () => {
    setupMonthlyEnrollment();

    const result = await registerMonthlyPayment(INPUT);

    expect(result).toEqual({
      success: true,
      data: { id: PAYMENT_ID, next_due_date: "2026-12-05" },
    });
  });
});
