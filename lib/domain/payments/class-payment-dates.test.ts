/**
 * Class payment `class_date` reaches Prisma as the UTC-midnight instant.
 *
 * `class_date` is a Postgres `date` column, which keeps only the UTC calendar
 * day of the instant it receives. Building LOCAL midnight (parseDateOnly)
 * stores the right day only on servers at or west of UTC; on any server east
 * of UTC it lands on the previous day. The assertion pins the exact instant,
 * so it fails on any machine, not only on one in an eastern timezone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

const mockCreateClassPayment = vi.fn();
const mockGetBranchPaymentSettings = vi.fn();
vi.mock("./class-payment", () => ({
  createClassPaymentForOccurrence: (...args: unknown[]) =>
    mockCreateClassPayment(...args),
  getBranchPaymentSettings: (...args: unknown[]) =>
    mockGetBranchPaymentSettings(...args),
}));

import { correctClassPayment, registerClassPayment } from "./actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "cccccccc-1111-4222-a333-444444444444";
const PAYMENT_ID = "dddddddd-1111-4222-a333-444444444444";
const USER_ID = "eeeeeeee-1111-4222-a333-444444444444";

const ADMIN_CTX = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_A }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerClassPayment class_date", () => {
  it("passes the chosen class day as UTC midnight", async () => {
    mockCreateClassPayment.mockResolvedValue({ ok: true, id: PAYMENT_ID, amount: 5 });
    mockWithAuth.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => ({
        success: true,
        data: await fn({}, ADMIN_CTX),
      })
    );

    await registerClassPayment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
      class_date: "2026-10-26",
    });

    const params = mockCreateClassPayment.mock.calls[0][0] as { class_date: Date };
    expect(params.class_date.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("correctClassPayment class_date", () => {
  it("writes the corrected class day as UTC midnight", async () => {
    const update = vi.fn().mockResolvedValue({ id: PAYMENT_ID });
    const tx = {
      class_payments: {
        findUnique: vi.fn().mockResolvedValue({
          id: PAYMENT_ID,
          created_at: new Date(),
          student_discipline_id: ENROLLMENT_ID,
          student_disciplines: { students: { branch_id: BRANCH_A } },
        }),
        update,
      },
    };
    mockGetBranchPaymentSettings.mockResolvedValue({
      payment_due_day: 5,
      payment_edit_window_days: 7,
    });
    mockWithAuth.mockImplementation(
      async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => ({
        success: true,
        data: await fn(tx, ADMIN_CTX),
      })
    );

    const result = await correctClassPayment({
      id: PAYMENT_ID,
      amount: 6,
      class_date: "2026-10-26",
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    const data = update.mock.calls[0][0].data as { class_date: Date };
    expect(data.class_date.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});
