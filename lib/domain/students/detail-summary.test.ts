import { describe, it, expect } from "vitest";

import {
  getAgeInYears,
  getLatestPaidThrough,
  orderEnrollmentsActiveFirst,
} from "./detail-summary";
import { getCurrentDateOnly } from "@/lib/date";
import type { PaymentRecord } from "@/lib/domain/payments/actions";
import type { StudentDisciplineRecord } from "@/lib/domain/disciplines/actions";

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function monthlyPayment(
  id: string,
  disciplineName: string,
  periodEnd: Date
): PaymentRecord {
  return {
    id,
    discipline_name: disciplineName,
    amount: 30,
    months_covered: 1,
    period_start: utcDate(2025, 1, 1),
    period_end: periodEnd,
    payment_date: utcDate(2025, 1, 5),
    recorded_by: "user-1",
    note: null,
    created_at: utcDate(2025, 1, 5),
  };
}

function enrollment(
  id: string,
  disciplineId: string,
  disciplineName: string,
  isActive: boolean
): StudentDisciplineRecord {
  return {
    id,
    discipline_id: disciplineId,
    discipline_name: disciplineName,
    enrolled_at: utcDate(2024, 6, 1),
    is_active: isActive,
    suspended_at: isActive ? null : utcDate(2025, 1, 1),
    billing_mode: "monthly",
  };
}

describe("getAgeInYears", () => {
  it("returns the completed age for a date-only birth value", () => {
    expect(getAgeInYears(utcDate(2000, 6, 14), "2025-06-15")).toBe(25);
  });

  it("counts the birthday itself as reached (no off-by-one on the birthday)", () => {
    expect(getAgeInYears(utcDate(2000, 6, 15), "2025-06-15")).toBe(25);
  });

  it("does not count a birthday that happens tomorrow", () => {
    expect(getAgeInYears(utcDate(2000, 6, 16), "2025-06-15")).toBe(24);
  });

  it("treats February 29 birthdays as reached on March 1 of non-leap years", () => {
    expect(getAgeInYears(utcDate(2000, 2, 29), "2025-03-01")).toBe(25);
    expect(getAgeInYears(utcDate(2000, 2, 29), "2025-02-28")).toBe(24);
  });

  it("uses the branch-local date, not the UTC date, for the birthday boundary", () => {
    // 2026-03-10T02:00:00Z is still 2026-03-09 in America/Guayaquil (UTC-5),
    // so a birthday on 2026-03-10 must NOT be counted yet.
    const instant = new Date("2026-03-10T02:00:00.000Z");
    const todayDateOnly = getCurrentDateOnly("America/Guayaquil", instant);

    expect(todayDateOnly).toBe("2026-03-09");
    expect(getAgeInYears(utcDate(2000, 3, 10), todayDateOnly)).toBe(25);
  });
});

describe("getLatestPaidThrough", () => {
  it("returns null when there are no payments", () => {
    expect(getLatestPaidThrough([], "Karate")).toBeNull();
  });

  it("returns null when no payment matches the discipline name", () => {
    const payments = [
      monthlyPayment("p1", "Yoga", utcDate(2025, 2, 1)),
      monthlyPayment("p2", "Natación", utcDate(2025, 3, 1)),
    ];

    expect(getLatestPaidThrough(payments, "Karate")).toBeNull();
  });

  it("returns the latest period_end among matching payments", () => {
    const latest = utcDate(2025, 4, 1);
    const payments = [
      monthlyPayment("p1", "Karate", utcDate(2025, 2, 1)),
      monthlyPayment("p2", "Karate", latest),
      monthlyPayment("p3", "Yoga", utcDate(2025, 9, 1)),
    ];

    expect(getLatestPaidThrough(payments, "Karate")).toBe(latest);
  });

  it("matches the discipline name ignoring surrounding whitespace", () => {
    const payments = [monthlyPayment("p1", "Karate ", utcDate(2025, 2, 1))];

    expect(getLatestPaidThrough(payments, "Karate")).toEqual(
      utcDate(2025, 2, 1)
    );
  });

  it("does not match a different discipline with a similar name", () => {
    const payments = [monthlyPayment("p1", "Karate Kids", utcDate(2025, 2, 1))];

    expect(getLatestPaidThrough(payments, "Karate")).toBeNull();
  });
});

describe("orderEnrollmentsActiveFirst", () => {
  it("returns an empty array for no enrollments", () => {
    expect(orderEnrollmentsActiveFirst([])).toEqual([]);
  });

  it("puts active enrollments first and preserves relative order", () => {
    const ordered = orderEnrollmentsActiveFirst([
      enrollment("e1", "d1", "Yoga", false),
      enrollment("e2", "d2", "Karate", true),
      enrollment("e3", "d3", "Natación", false),
      enrollment("e4", "d4", "Ballet", true),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["e2", "e4", "e1", "e3"]);
  });

  it("keeps the original order when every enrollment is active", () => {
    const ordered = orderEnrollmentsActiveFirst([
      enrollment("e1", "d1", "Yoga", true),
      enrollment("e2", "d2", "Karate", true),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["e1", "e2"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      enrollment("e1", "d1", "Yoga", false),
      enrollment("e2", "d2", "Karate", true),
    ];

    orderEnrollmentsActiveFirst(input);

    expect(input.map((item) => item.id)).toEqual(["e1", "e2"]);
  });
});
