/**
 * Payment query tests — branch-scoped overdue and current-month summary queries,
 * including branch time zone resolution for "today".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionClient } from "@/lib/prisma/client";
import {
  countOverdueStudents,
  getBranchLocalToday,
  getMonthlyPaymentSummaryQuery,
  listOverdueStudents,
} from "./queries";

const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const DISCIPLINE_ID = "bbbbbbbb-1111-4222-a333-444444444444";

function createTransaction(value: unknown): TransactionClient {
  return value as TransactionClient;
}

function createBranchTimeZoneMock(timeZone: string | null) {
  return vi
    .fn()
    .mockResolvedValue(timeZone === null ? null : { time_zone: timeZone });
}

describe("countOverdueStudents", () => {
  it("includes the branch filter", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([{ student_id: "s1" }]);
    const mockTx = createTransaction({
      branches: { findUnique: createBranchTimeZoneMock("America/Guayaquil") },
      student_disciplines: { findMany: mockFindMany },
    });

    await countOverdueStudents(mockTx, BRANCH_ID);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.students).toMatchObject({ branch_id: BRANCH_ID });
  });

  it("compares against the branch-local UTC-midnight date", async () => {
    vi.useFakeTimers();
    try {
      // 03:00Z is 22:00 on 2026-09-30 in Guayaquil (UTC-5).
      vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockTx = createTransaction({
        branches: { findUnique: createBranchTimeZoneMock("America/Guayaquil") },
        student_disciplines: { findMany: mockFindMany },
      });

      await countOverdueStudents(mockTx, BRANCH_ID);

      expect(mockFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-09-30T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves today from the branch time zone, not UTC", async () => {
    vi.useFakeTimers();
    try {
      // 05:00Z is 2026-10-01 00:00 in Guayaquil (UTC-5) but 2026-09-30 23:00
      // in Galápagos (UTC-6).
      vi.setSystemTime(new Date("2026-10-01T05:00:00Z"));

      const guayaquilFindMany = vi.fn().mockResolvedValue([]);
      await countOverdueStudents(
        createTransaction({
          branches: {
            findUnique: createBranchTimeZoneMock("America/Guayaquil"),
          },
          student_disciplines: { findMany: guayaquilFindMany },
        }),
        BRANCH_ID
      );
      expect(guayaquilFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-10-01T00:00:00.000Z"),
      });

      const galapagosFindMany = vi.fn().mockResolvedValue([]);
      await countOverdueStudents(
        createTransaction({
          branches: {
            findUnique: createBranchTimeZoneMock("Pacific/Galapagos"),
          },
          student_disciplines: { findMany: galapagosFindMany },
        }),
        BRANCH_ID
      );
      expect(galapagosFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-09-30T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the continental Ecuador time zone without a branch row", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockTx = createTransaction({
        branches: { findUnique: createBranchTimeZoneMock(null) },
        student_disciplines: { findMany: mockFindMany },
      });

      await countOverdueStudents(mockTx, BRANCH_ID);

      expect(mockFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-09-30T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getBranchLocalToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the branch-local date for a fixed instant", async () => {
    vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
    const mockTx = createTransaction({
      branches: { findUnique: createBranchTimeZoneMock("America/Guayaquil") },
    });

    await expect(getBranchLocalToday(mockTx, BRANCH_ID)).resolves.toBe(
      "2026-09-30"
    );
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
      branches: { findUnique: createBranchTimeZoneMock("America/Guayaquil") },
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

  it("uses the branch-local UTC-midnight date in the overdue filter", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockTx = createTransaction({
        branches: { findUnique: createBranchTimeZoneMock("America/Guayaquil") },
        student_disciplines: { findMany: mockFindMany },
      });

      await listOverdueStudents(mockTx, BRANCH_ID);

      expect(mockFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-09-30T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getMonthlyPaymentSummaryQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createSummaryTransaction(
    monthlyFindMany: ReturnType<typeof vi.fn>,
    classFindMany: ReturnType<typeof vi.fn>,
    overdueFindMany: ReturnType<typeof vi.fn>,
    timeZone: string | null = "America/Guayaquil"
  ) {
    return createTransaction({
      branches: { findUnique: createBranchTimeZoneMock(timeZone) },
      payments: { findMany: monthlyFindMany },
      class_payments: { findMany: classFindMany },
      student_disciplines: { findMany: overdueFindMany },
    });
  }

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
    const mockTx = createSummaryTransaction(
      monthlyFindMany,
      classFindMany,
      overdueFindMany
    );

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

  it("derives month bounds and the overdue filter from the branch-local date", async () => {
    vi.useFakeTimers();
    try {
      // 03:00Z is 2026-09-30 in Guayaquil: September bounds, overdue < Sep 30.
      vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
      const monthlyFindMany = vi.fn().mockResolvedValue([]);
      const classFindMany = vi.fn().mockResolvedValue([]);
      const overdueFindMany = vi.fn().mockResolvedValue([]);
      const mockTx = createSummaryTransaction(
        monthlyFindMany,
        classFindMany,
        overdueFindMany
      );

      await getMonthlyPaymentSummaryQuery(mockTx, BRANCH_ID);

      expect(monthlyFindMany.mock.calls[0][0].where.payment_date).toEqual({
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-10-01T00:00:00.000Z"),
      });
      expect(classFindMany.mock.calls[0][0].where.class_date).toEqual({
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-10-01T00:00:00.000Z"),
      });
      expect(overdueFindMany.mock.calls[0][0].where.next_due_date).toEqual({
        lt: new Date("2026-09-30T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rolls December month bounds over to the next year", async () => {
    vi.useFakeTimers();
    try {
      // 03:00Z on 2027-01-01 is 2026-12-31 in Guayaquil.
      vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
      const monthlyFindMany = vi.fn().mockResolvedValue([]);
      const classFindMany = vi.fn().mockResolvedValue([]);
      const overdueFindMany = vi.fn().mockResolvedValue([]);
      const mockTx = createSummaryTransaction(
        monthlyFindMany,
        classFindMany,
        overdueFindMany
      );

      await getMonthlyPaymentSummaryQuery(mockTx, BRANCH_ID);

      expect(monthlyFindMany.mock.calls[0][0].where.payment_date).toEqual({
        gte: new Date("2026-12-01T00:00:00.000Z"),
        lt: new Date("2027-01-01T00:00:00.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
