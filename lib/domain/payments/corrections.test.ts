import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: vi.fn(),
}));
vi.mock("./queries", () => ({
  countOverdueStudents: vi.fn(),
  getMonthlyPaymentSummaryQuery: vi.fn(),
  listOverdueStudents: vi.fn(),
}));

import { deriveMonthsCovered, registerMonthlyPaymentSchema } from "./schema";
import {
  calculateClampedDueDate,
  getMonthlyPaymentPeriod,
  isPaymentCorrectionWithinWindow,
  reconcileNextDueDate,
} from "./reconciliation";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "bbbbbbbb-1111-4222-a333-444444444444";

function monthlyInput(periodStart: string, periodEnd: string) {
  return {
    student_discipline_id: ENROLLMENT_ID,
    amount: 25,
    period_start: periodStart,
    period_end: periodEnd,
    branch_id: BRANCH_ID,
  };
}

describe("monthly coverage validation", () => {
  it("counts April 2026 through April 2027 inclusively as 13 months", () => {
    expect(deriveMonthsCovered("2026-04-01", "2027-05-01")).toBe(13);
    expect(registerMonthlyPaymentSchema.safeParse(monthlyInput("2026-04-01", "2027-05-01")).success).toBe(true);
  });

  it("accepts 24 months and rejects 25 months", () => {
    expect(registerMonthlyPaymentSchema.safeParse(monthlyInput("2026-04-01", "2028-04-01")).success).toBe(true);
    expect(registerMonthlyPaymentSchema.safeParse(monthlyInput("2026-04-01", "2028-05-01")).success).toBe(false);
  });
});

describe("monthly payment period conversion", () => {
  it("converts an inclusive cross-year month range into a half-open period", () => {
    expect(getMonthlyPaymentPeriod("2026-12", "2027-02")).toEqual({
      period: { period_start: "2026-12-01", period_end: "2027-03-01" },
      error: null,
    });
  });

  it("rejects reverse month ranges and ranges longer than 24 months", () => {
    expect(getMonthlyPaymentPeriod("2027-02", "2026-12")).toEqual({
      period: null,
      error: "end_before_start",
    });
    expect(getMonthlyPaymentPeriod("2026-04", "2028-04")).toEqual({
      period: null,
      error: "duration_exceeds_max",
    });
  });
});

describe("payment reconciliation", () => {
  it("clamps a configured due day to month end", () => {
    expect(calculateClampedDueDate("2027-02-01", 31)).toBe("2027-02-28");
    expect(calculateClampedDueDate("2028-02-01", 31)).toBe("2028-02-29");
  });

  it("reconciles the first uncovered month after a correction", () => {
    expect(reconcileNextDueDate([
      { period_start: "2026-04-01", period_end: "2026-05-01" },
      { period_start: "2026-05-01", period_end: "2026-07-01" },
    ], 5)).toBe("2026-07-05");
  });

  it("reconciles the remaining coverage after a deletion", () => {
    expect(reconcileNextDueDate([
      { period_start: "2026-05-01", period_end: "2026-07-01" },
    ], 5)).toBe("2026-07-05");
  });
});

describe("correction window", () => {
  it("allows the configured exact rolling-window boundary and rejects the next millisecond", () => {
    const createdAt = new Date("2026-04-01T12:00:00.000Z");
    expect(isPaymentCorrectionWithinWindow(createdAt, 3, new Date("2026-04-04T12:00:00.000Z"))).toBe(true);
    expect(isPaymentCorrectionWithinWindow(createdAt, 3, new Date("2026-04-04T12:00:00.001Z"))).toBe(false);
  });

  it("uses immutable timestamps without date-only parsing, formatting, or mutation", () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const now = new Date("2026-04-02T00:00:00.000Z");
    const createdAtTime = createdAt.getTime();
    const nowTime = now.getTime();

    expect(isPaymentCorrectionWithinWindow(createdAt, 1, now)).toBe(true);
    expect(createdAt.getTime()).toBe(createdAtTime);
    expect(now.getTime()).toBe(nowTime);
  });
});
