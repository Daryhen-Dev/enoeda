/**
 * Pure payment validation tests — enrollment classification boundaries and
 * branch-local month bounds for timestamptz filtering (both Ecuador zones).
 */
import { describe, expect, it } from "vitest";

import {
  classifyEnrollment,
  getBranchLocalMonthBounds,
  PAYMENT_VALIDATION_STATUS,
} from "./validation";

describe("classifyEnrollment", () => {
  it("classifies a due date today as up_to_date", () => {
    const result = classifyEnrollment({
      nextDueDate: "2026-10-01",
      today: "2026-10-01",
      graceDays: 0,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.UP_TO_DATE);
    expect(result.daysOverdue).toBe(0);
    expect(result.graceDeadline).toBe("2026-10-01");
  });

  it("classifies a future due date as up_to_date", () => {
    const result = classifyEnrollment({
      nextDueDate: "2026-10-05",
      today: "2026-10-01",
      graceDays: 0,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.UP_TO_DATE);
    expect(result.daysOverdue).toBe(0);
  });

  it("classifies a null due date as up_to_date without a deadline", () => {
    const result = classifyEnrollment({
      nextDueDate: null,
      today: "2026-10-01",
      graceDays: 3,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.UP_TO_DATE);
    expect(result.daysOverdue).toBe(0);
    expect(result.graceDeadline).toBeNull();
  });

  it("classifies one day overdue with zero grace as to_suspend", () => {
    const result = classifyEnrollment({
      nextDueDate: "2026-09-30",
      today: "2026-10-01",
      graceDays: 0,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.TO_SUSPEND);
    expect(result.daysOverdue).toBe(1);
    expect(result.graceDeadline).toBe("2026-09-30");
  });

  it("stays in_grace on the grace deadline day", () => {
    // Due 2026-09-28 with 3 grace days -> deadline 2026-10-01.
    const result = classifyEnrollment({
      nextDueDate: "2026-09-28",
      today: "2026-10-01",
      graceDays: 3,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.IN_GRACE);
    expect(result.daysOverdue).toBe(3);
    expect(result.graceDeadline).toBe("2026-10-01");
  });

  it("flips to to_suspend the day after the grace deadline", () => {
    const result = classifyEnrollment({
      nextDueDate: "2026-09-28",
      today: "2026-10-02",
      graceDays: 3,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.TO_SUSPEND);
    expect(result.daysOverdue).toBe(4);
  });

  it("counts overdue days across a month boundary", () => {
    // January has 31 days: due 2026-01-31 -> 2026-02-02 is 2 days later.
    const result = classifyEnrollment({
      nextDueDate: "2026-01-31",
      today: "2026-02-02",
      graceDays: 0,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.TO_SUSPEND);
    expect(result.daysOverdue).toBe(2);
  });

  it("carries the grace deadline across a month boundary", () => {
    // Due 2026-01-31 + 3 grace days -> deadline 2026-02-03.
    const inGrace = classifyEnrollment({
      nextDueDate: "2026-01-31",
      today: "2026-02-03",
      graceDays: 3,
    });
    const toSuspend = classifyEnrollment({
      nextDueDate: "2026-01-31",
      today: "2026-02-04",
      graceDays: 3,
    });

    expect(inGrace.status).toBe(PAYMENT_VALIDATION_STATUS.IN_GRACE);
    expect(inGrace.graceDeadline).toBe("2026-02-03");
    expect(toSuspend.status).toBe(PAYMENT_VALIDATION_STATUS.TO_SUSPEND);
  });

  it("treats a deadline within a leap February correctly", () => {
    // Due 2028-02-28 + 1 grace day -> deadline 2028-02-29 (leap year).
    const result = classifyEnrollment({
      nextDueDate: "2028-02-28",
      today: "2028-02-29",
      graceDays: 1,
    });

    expect(result.status).toBe(PAYMENT_VALIDATION_STATUS.IN_GRACE);
    expect(result.graceDeadline).toBe("2028-02-29");
  });
});

describe("getBranchLocalMonthBounds", () => {
  it("resolves October bounds for the continental Ecuador zone (UTC-5)", () => {
    const { start, end } = getBranchLocalMonthBounds("2026-10-01", "America/Guayaquil");

    expect(start.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("resolves October bounds for the Galapagos zone (UTC-6)", () => {
    const { start, end } = getBranchLocalMonthBounds("2026-10-01", "Pacific/Galapagos");

    expect(start.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("resolves a mid-month anchor to the same month bounds", () => {
    const { start, end } = getBranchLocalMonthBounds("2026-10-17", "America/Guayaquil");

    expect(start.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("wraps December bounds into the next year", () => {
    const { start, end } = getBranchLocalMonthBounds("2026-12-25", "America/Guayaquil");

    expect(start.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });
});
