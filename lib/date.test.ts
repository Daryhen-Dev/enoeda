/**
 * Date helper tests — date-only conversions and branch-local today.
 */
import { describe, expect, it } from "vitest";

import {
  dateOnlyToUtcDate,
  formatDateOnly,
  getCurrentDateOnly,
  todayDateOnlyUtc,
} from "./date";

describe("dateOnlyToUtcDate", () => {
  it("converts a date-only string into the UTC-midnight instant", () => {
    expect(dateOnlyToUtcDate("2026-09-30").toISOString()).toBe(
      "2026-09-30T00:00:00.000Z"
    );
  });

  it("rejects malformed or impossible dates", () => {
    expect(() => dateOnlyToUtcDate("not-a-date")).toThrow();
    expect(() => dateOnlyToUtcDate("2026-9-30")).toThrow();
    expect(() => dateOnlyToUtcDate("2026-02-30")).toThrow();
  });
});

describe("todayDateOnlyUtc", () => {
  it("converts the server-local calendar day into its UTC-midnight instant", () => {
    // 03:00Z is still the previous local day in Ecuador (UTC-5) and the same
    // local day in Madrid (UTC+2): the expectation is derived from the same
    // server-local calendar day, so it holds on any machine.
    const instant = new Date("2026-10-26T03:00:00Z");

    expect(todayDateOnlyUtc(instant).toISOString()).toBe(
      dateOnlyToUtcDate(formatDateOnly(instant)).toISOString()
    );
  });

  it("returns UTC midnight, never a local midnight", () => {
    const value = todayDateOnlyUtc(new Date("2026-10-26T15:00:00Z"));

    expect(value.getUTCHours()).toBe(0);
    expect(value.getUTCMinutes()).toBe(0);
    expect(value.getUTCSeconds()).toBe(0);
    expect(value.getUTCMilliseconds()).toBe(0);
    expect(value.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });

  it("defaults to the current instant", () => {
    const now = new Date();

    expect(todayDateOnlyUtc().toISOString()).toBe(
      dateOnlyToUtcDate(formatDateOnly(now)).toISOString()
    );
  });
});

describe("getCurrentDateOnly", () => {
  it("maps a fixed instant to the branch-local calendar date", () => {
    const instant = new Date("2026-10-01T03:00:00Z");

    expect(getCurrentDateOnly("America/Guayaquil", instant)).toBe("2026-09-30");
  });

  it("crosses the local day boundary at local midnight, not UTC midnight", () => {
    // 05:00Z is 00:00 in Guayaquil (UTC-5) but 23:00 the previous day in
    // Galápagos (UTC-6).
    const instant = new Date("2026-10-01T05:00:00Z");

    expect(getCurrentDateOnly("America/Guayaquil", instant)).toBe("2026-10-01");
    expect(getCurrentDateOnly("Pacific/Galapagos", instant)).toBe("2026-09-30");
  });
});
