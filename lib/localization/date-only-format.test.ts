/**
 * formatDateOnly — date-only columns (Postgres `date`) shown as the calendar
 * day they store, in every timezone.
 *
 * Prisma returns a `date` column as UTC midnight. `formatDate` renders an
 * instant in the viewer's timezone, so in Ecuador (UTC-5) UTC midnight of the
 * 26th is 19:00 of the 25th: a payment registered on 26 oct showed as
 * "25 oct 2026". That is right for a real instant (a timestamp) and wrong for
 * a calendar day.
 */

import { describe, expect, it } from "vitest";

import { formatDate, formatDateOnlyValue } from "./es-ec";

/** UTC midnight, exactly how Prisma hands back a Postgres `date` column. */
const STORED_26_OCT = new Date("2026-10-26T00:00:00.000Z");

describe("formatDateOnlyValue", () => {
  it("shows the stored calendar day from a UTC-midnight Date", () => {
    expect(formatDateOnlyValue(STORED_26_OCT)).toBe(
      formatDate(new Date(2026, 9, 26))
    );
  });

  it("accepts the YYYY-MM-DD string date-only values travel as", () => {
    expect(formatDateOnlyValue("2026-10-26")).toBe(
      formatDate(new Date(2026, 9, 26))
    );
  });

  it("never shifts a month boundary", () => {
    // 1 nov at UTC midnight is still 31 oct in Ecuador.
    expect(formatDateOnlyValue(new Date("2026-11-01T00:00:00.000Z"))).toBe(
      formatDate(new Date(2026, 10, 1))
    );
  });

  it("never shifts a year boundary", () => {
    expect(formatDateOnlyValue(new Date("2027-01-01T00:00:00.000Z"))).toBe(
      formatDate(new Date(2027, 0, 1))
    );
  });

  it("documents why formatDate is the wrong tool for a date column", () => {
    // In any timezone west of UTC, formatDate moves the stored day back.
    if (new Date(0).getTimezoneOffset() > 0) {
      expect(formatDate(STORED_26_OCT)).not.toBe(
        formatDateOnlyValue(STORED_26_OCT)
      );
    }
  });
});
