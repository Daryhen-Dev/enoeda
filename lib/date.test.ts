/**
 * Date helper tests — date-only conversions and branch-local today.
 */
import { describe, expect, it } from "vitest";

import { dateOnlyToUtcDate, getCurrentDateOnly } from "./date";

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
