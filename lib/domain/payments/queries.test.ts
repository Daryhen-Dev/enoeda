/**
 * Payment query tests — branch-scoped overdue and current-month summary queries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionClient } from "@/lib/prisma/client";
import {
  countOverdueStudents,
  getMonthlyPaymentSummaryQuery,
  listOverdueStudents,
} from "./queries";

const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const DISCIPLINE_ID = "bbbbbbbb-1111-4222-a333-444444444444";

function createTransaction(value: unknown): TransactionClient {
  return value as TransactionClient;
}

describe("countOverdueStudents", () => {
  it("includes the branch filter", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([{ student_id: "s1" }]);
    const mockTx = createTransaction({
      student_disciplines: { findMany: mockFindMany },
    });

    await countOverdueStudents(mockTx, BRANCH_ID);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.students).toMatchObject({ branch_id: BRANCH_ID });
  });
});

describe("listOverdueStudents", () => {
  it("keeps one row per enrollment and includes its identifier", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      {
        id: "enrollment-1",
        students: { id: "student-1", first_name: "Ana", surname: "Luz" },
        disciplines: { name: "Piano" },
        next_due_date: new Date(2026, 0, 1),
      },
      {
        id: "enrollment-2",
        students: { id: "student-1", first_name: "Ana", surname: "Luz" },
        disciplines: { name: "Violín" },
        next_due_date: new Date(2026, 0, 2),
      },
    ]);
    const mockTx = createTransaction({
      student_disciplines: { findMany: mockFindMany },
    });

    const rows = await listOverdueStudents(mockTx, BRANCH_ID, DISCIPLINE_ID);

    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({
      discipline_id: DISCIPLINE_ID,
      students: { branch_id: BRANCH_ID },
    });
    expect(mockFindMany.mock.calls[0][0]).not.toHaveProperty("distinct");
    expect(rows).toEqual([
      expect.objectContaining({ student_discipline_id: "enrollment-1" }),
      expect.objectContaining({ student_discipline_id: "enrollment-2" }),
    ]);
  });
});

describe("getMonthlyPaymentSummaryQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes both sources to the branch and maps current activity by date and limit", async () => {
    const monthlyFindMany = vi.fn().mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        id: `monthly-${index + 1}`,
        amount: index + 1,
        payment_date: new Date(2026, 0, index + 1),
        student_disciplines: {
          student_id: `student-${index + 1}`,
          students: { first_name: "Ana", surname: "Luz" },
          disciplines: { name: "Piano" },
        },
      }))
    );
    const classFindMany = vi.fn().mockResolvedValue([
      {
        id: "class-1",
        amount: "5.25",
        class_date: new Date(2026, 0, 20),
        student_disciplines: {
          student_id: "student-class",
          students: { first_name: "Luis", surname: "Mar" },
          disciplines: { name: "Guitarra" },
        },
      },
    ]);
    const overdueFindMany = vi.fn().mockResolvedValue([]);
    const mockTx = createTransaction({
      payments: { findMany: monthlyFindMany },
      class_payments: { findMany: classFindMany },
      student_disciplines: { findMany: overdueFindMany },
    });

    const summary = await getMonthlyPaymentSummaryQuery(
      mockTx,
      BRANCH_ID,
      DISCIPLINE_ID
    );

    for (const query of [monthlyFindMany, classFindMany]) {
      const callArgs = query.mock.calls[0][0];
      expect(callArgs.where.student_disciplines).toMatchObject({
        discipline_id: DISCIPLINE_ID,
        students: { branch_id: BRANCH_ID },
      });
      expect(callArgs.where[query === monthlyFindMany ? "payment_date" : "class_date"])
        .toMatchObject({ gte: expect.any(Date), lt: expect.any(Date) });
    }
    expect(summary).toMatchObject({
      totalMoneyCollected: 71.25,
      monthlyPaymentCount: 11,
      classPaymentCount: 1,
    });
    expect(summary.recentActivity).toContainEqual(
      expect.objectContaining({
        amount: 5.25,
        type: "class",
        student_id: "student-class",
      })
    );
    expect(summary.recentActivity).toHaveLength(10);
    expect(summary.recentActivity[0]?.type).toBe("class");
  });
});
