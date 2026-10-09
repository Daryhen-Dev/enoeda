/**
 * Roster cleanup helper — removes a student from the current and future
 * rosters of one discipline (monthly class groups whose period_month is the
 * current month or later, and one-time classes dated today or later).
 * Past months and past one-time classes are never touched.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TransactionClient } from "@/lib/prisma/client";

vi.mock("@/lib/domain/payments/queries", () => ({
  getBranchLocalToday: vi.fn().mockResolvedValue("2026-10-15"),
}));

import { removeStudentFromCurrentAndFutureRosters } from "./cleanup";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const STUDENT_ID = "bbbbbbbb-1111-4222-a333-444444444444";
const DISCIPLINE_ID = "cccccccc-1111-4222-a333-444444444444";

const CURRENT_MONTH_START = new Date("2026-10-01T00:00:00.000Z");
const TODAY_UTC = new Date("2026-10-15T00:00:00.000Z");

function createTx(overrides: Record<string, unknown> = {}): TransactionClient {
  return {
    class_series: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    one_time_classes: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    class_series_students: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    one_time_class_students: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as unknown as TransactionClient;
}

describe("removeStudentFromCurrentAndFutureRosters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes series roster rows only for groups in the current month or later", async () => {
    const tx = createTx({
      class_series: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "series-1" }, { id: "series-2" }]),
      },
      class_series_students: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    });

    const removed = await removeStudentFromCurrentAndFutureRosters(tx, {
      branchId: BRANCH_ID,
      studentId: STUDENT_ID,
      disciplineId: DISCIPLINE_ID,
    });

    expect(tx.class_series.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_ID,
        period_month: { gte: CURRENT_MONTH_START },
      },
      select: { id: true },
    });
    expect(tx.class_series_students.deleteMany).toHaveBeenCalledWith({
      where: {
        series_id: { in: ["series-1", "series-2"] },
        student_id: STUDENT_ID,
      },
    });
    expect(removed).toBe(2);
  });

  it("skips the series deletion when the discipline has no current or future groups", async () => {
    const tx = createTx();

    await removeStudentFromCurrentAndFutureRosters(tx, {
      branchId: BRANCH_ID,
      studentId: STUDENT_ID,
      disciplineId: DISCIPLINE_ID,
    });

    expect(tx.class_series_students.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes one-time class roster rows only for classes dated today or later", async () => {
    const tx = createTx({
      one_time_classes: {
        findMany: vi.fn().mockResolvedValue([{ id: "one-time-1" }]),
      },
      one_time_class_students: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });

    const removed = await removeStudentFromCurrentAndFutureRosters(tx, {
      branchId: BRANCH_ID,
      studentId: STUDENT_ID,
      disciplineId: DISCIPLINE_ID,
    });

    expect(tx.one_time_classes.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_ID,
        class_date: { gte: TODAY_UTC },
      },
      select: { id: true },
    });
    expect(tx.one_time_class_students.deleteMany).toHaveBeenCalledWith({
      where: {
        one_time_class_id: { in: ["one-time-1"] },
        student_id: STUDENT_ID,
      },
    });
    expect(removed).toBe(1);
  });

  it("skips the one-time deletion when the discipline has no upcoming one-time classes", async () => {
    const tx = createTx();

    await removeStudentFromCurrentAndFutureRosters(tx, {
      branchId: BRANCH_ID,
      studentId: STUDENT_ID,
      disciplineId: DISCIPLINE_ID,
    });

    expect(tx.one_time_class_students.deleteMany).not.toHaveBeenCalled();
  });

  it("returns the combined removed count across series and one-time rosters", async () => {
    const tx = createTx({
      class_series: {
        findMany: vi.fn().mockResolvedValue([{ id: "series-1" }]),
      },
      class_series_students: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      one_time_classes: {
        findMany: vi.fn().mockResolvedValue([{ id: "one-time-1" }]),
      },
      one_time_class_students: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    });

    const removed = await removeStudentFromCurrentAndFutureRosters(tx, {
      branchId: BRANCH_ID,
      studentId: STUDENT_ID,
      disciplineId: DISCIPLINE_ID,
    });

    expect(removed).toBe(5);
  });
});
