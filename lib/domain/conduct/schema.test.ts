import { describe, it, expect } from "vitest";

import {
  createConductRecordSchema,
  voidConductRecordSchema,
  searchConductStudentsSchema,
  listRecentBranchConductRecordsSchema,
  listBranchConductRecordsSchema,
  RECENT_CONDUCT_LIMITS,
  CONDUCT_KINDS,
  CONDUCT_STATUSES,
} from "./schema";
import { CONDUCT_MESSAGES, ROSTER_MESSAGES } from "@/lib/localization/es-ec";

const STUDENT_ID = "b1111111-1111-4111-8111-111111111111";
const BRANCH_ID = "a0000000-0000-4000-8000-000000000001";

function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function fineInput(overrides: Record<string, unknown> = {}) {
  return {
    student_id: STUDENT_ID,
    branch_id: BRANCH_ID,
    kind: CONDUCT_KINDS.FINE,
    reason: "Daño al equipo",
    amount: 10,
    ...overrides,
  };
}

function warningInput(overrides: Record<string, unknown> = {}) {
  return {
    student_id: STUDENT_ID,
    branch_id: BRANCH_ID,
    kind: CONDUCT_KINDS.WARNING,
    reason: "Interrumpió la clase",
    ...overrides,
  };
}

describe("createConductRecordSchema", () => {
  it("accepts a valid fine", () => {
    const result = createConductRecordSchema.safeParse(fineInput());
    expect(result.success).toBe(true);
  });

  it("accepts a valid warning without amount", () => {
    const result = createConductRecordSchema.safeParse(warningInput());
    expect(result.success).toBe(true);
  });

  it("requires a positive amount for fines", () => {
    const result = createConductRecordSchema.safeParse(fineInput({ amount: 0 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.AMOUNT_POSITIVE
      );
    }
  });

  it("rejects a fine with more than two decimals", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ amount: 10.555 })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.AMOUNT_DECIMALS
      );
    }
  });

  it("rejects a fine amount above the maximum", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ amount: 100000000 })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(CONDUCT_MESSAGES.AMOUNT_MAX);
    }
  });

  it("rejects an amount on a warning", () => {
    const result = createConductRecordSchema.safeParse(
      warningInput({ amount: 5 })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.AMOUNT_NOT_ALLOWED
      );
    }
  });

  it("trims the reason and rejects a whitespace-only reason", () => {
    const parsed = createConductRecordSchema.parse(
      fineInput({ reason: "  Llegó tarde  " })
    );
    expect(parsed.kind).toBe(CONDUCT_KINDS.FINE);
    if (parsed.kind === CONDUCT_KINDS.FINE) {
      expect(parsed.reason).toBe("Llegó tarde");
    }

    const result = createConductRecordSchema.safeParse(
      fineInput({ reason: "   " })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a reason longer than 2000 characters", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ reason: "x".repeat(2001) })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(CONDUCT_MESSAGES.REASON_MAX);
    }
  });

  it("defaults to no incident_date (action applies today)", () => {
    const parsed = createConductRecordSchema.parse(warningInput());
    expect(parsed.incident_date).toBeUndefined();
  });

  it("rejects a malformed incident_date", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ incident_date: "2026-13-01" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a future incident_date", () => {
    const nextYear = Number(todayDateString().slice(0, 4)) + 1;
    const result = createConductRecordSchema.safeParse(
      fineInput({ incident_date: `${nextYear}-01-01` })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.INCIDENT_DATE_NOT_FUTURE
      );
    }
  });

  it("accepts today as incident_date", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ incident_date: todayDateString() })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ kind: "suspension" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    const result = createConductRecordSchema.safeParse(
      fineInput({ status: CONDUCT_STATUSES.PAID })
    );
    expect(result.success).toBe(false);
  });
});

describe("voidConductRecordSchema", () => {
  const RECORD_ID = "e5555555-5555-4555-8555-555555555555";

  it("trims and accepts a void reason up to 500 characters", () => {
    const parsed = voidConductRecordSchema.parse({
      id: RECORD_ID,
      branch_id: BRANCH_ID,
      void_reason: "  Error de registro  ",
    });
    expect(parsed.void_reason).toBe("Error de registro");
  });

  it("rejects a whitespace-only void reason", () => {
    const result = voidConductRecordSchema.safeParse({
      id: RECORD_ID,
      branch_id: BRANCH_ID,
      void_reason: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a void reason longer than 500 characters", () => {
    const result = voidConductRecordSchema.safeParse({
      id: RECORD_ID,
      branch_id: BRANCH_ID,
      void_reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.VOID_REASON_MAX
      );
    }
  });
});

describe("searchConductStudentsSchema", () => {
  it("accepts a valid query and trims it", () => {
    const parsed = searchConductStudentsSchema.parse({
      branch_id: BRANCH_ID,
      query: "  Ana Pérez  ",
    });
    expect(parsed.query).toBe("Ana Pérez");
  });

  it("rejects a missing query", () => {
    const result = searchConductStudentsSchema.safeParse({
      branch_id: BRANCH_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.SEARCH_REQUIRED
      );
    }
  });

  it("rejects a whitespace-only query", () => {
    const result = searchConductStudentsSchema.safeParse({
      branch_id: BRANCH_ID,
      query: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.SEARCH_REQUIRED
      );
    }
  });

  it("rejects a query longer than 100 characters", () => {
    const result = searchConductStudentsSchema.safeParse({
      branch_id: BRANCH_ID,
      query: "x".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ROSTER_MESSAGES.SEARCH_MAX_LENGTH
      );
    }
  });

  it("rejects a missing branch_id", () => {
    const result = searchConductStudentsSchema.safeParse({ query: "Ana" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.BRANCH_REQUIRED
      );
    }
  });

  it("rejects unknown extra keys", () => {
    const result = searchConductStudentsSchema.safeParse({
      branch_id: BRANCH_ID,
      query: "Ana",
      limit: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("listBranchConductRecordsSchema", () => {
  it("defaults the limit to 10 when omitted", () => {
    const parsed = listBranchConductRecordsSchema.parse({
      branch_id: BRANCH_ID,
    });
    expect(parsed.limit).toBe(10);
    expect(parsed.limit).toBe(RECENT_CONDUCT_LIMITS.DEFAULT);
  });

  it("accepts an omitted student filter", () => {
    const parsed = listBranchConductRecordsSchema.parse({
      branch_id: BRANCH_ID,
      limit: 5,
    });
    expect(parsed.student_id).toBeUndefined();
  });

  it("accepts a student filter and limits 1 and 25", () => {
    expect(
      listBranchConductRecordsSchema.parse({
        branch_id: BRANCH_ID,
        student_id: STUDENT_ID,
        limit: 1,
      })
    ).toMatchObject({ student_id: STUDENT_ID, limit: 1 });
    expect(
      listBranchConductRecordsSchema.parse({
        branch_id: BRANCH_ID,
        limit: RECENT_CONDUCT_LIMITS.MAX,
      }).limit
    ).toBe(25);
  });

  it("rejects out-of-bounds and non-integer limits", () => {
    for (const limit of [0, 26, 10.5]) {
      const result = listBranchConductRecordsSchema.safeParse({
        branch_id: BRANCH_ID,
        limit,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          CONDUCT_MESSAGES.RECENT_LIMIT_INVALID
        );
      }
    }
  });

  it("rejects a non-numeric limit", () => {
    const result = listBranchConductRecordsSchema.safeParse({
      branch_id: BRANCH_ID,
      limit: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing branch_id", () => {
    const result = listBranchConductRecordsSchema.safeParse({ limit: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.BRANCH_REQUIRED
      );
    }
  });

  it("rejects a malformed student_id", () => {
    const result = listBranchConductRecordsSchema.safeParse({
      branch_id: BRANCH_ID,
      student_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        CONDUCT_MESSAGES.INVALID_STUDENT_ID
      );
    }
  });

  it("rejects unknown extra keys", () => {
    const result = listBranchConductRecordsSchema.safeParse({
      branch_id: BRANCH_ID,
      kind: CONDUCT_KINDS.FINE,
    });
    expect(result.success).toBe(false);
  });
});

describe("listRecentBranchConductRecordsSchema", () => {
  it("defaults the limit to 10 when omitted", () => {
    const parsed = listRecentBranchConductRecordsSchema.parse({
      branch_id: BRANCH_ID,
    });
    expect(parsed.limit).toBe(RECENT_CONDUCT_LIMITS.DEFAULT);
    expect(RECENT_CONDUCT_LIMITS.DEFAULT).toBe(10);
  });

  it("accepts limits 1 and 25", () => {
    expect(
      listRecentBranchConductRecordsSchema.parse({
        branch_id: BRANCH_ID,
        limit: 1,
      }).limit
    ).toBe(1);
    expect(
      listRecentBranchConductRecordsSchema.parse({
        branch_id: BRANCH_ID,
        limit: RECENT_CONDUCT_LIMITS.MAX,
      }).limit
    ).toBe(25);
  });

  it("rejects out-of-bounds and non-integer limits", () => {
    for (const limit of [0, 26, 10.5]) {
      const result = listRecentBranchConductRecordsSchema.safeParse({
        branch_id: BRANCH_ID,
        limit,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          CONDUCT_MESSAGES.RECENT_LIMIT_INVALID
        );
      }
    }
  });

  it("rejects a non-numeric limit", () => {
    const result = listRecentBranchConductRecordsSchema.safeParse({
      branch_id: BRANCH_ID,
      limit: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing branch_id", () => {
    const result = listRecentBranchConductRecordsSchema.safeParse({
      limit: 5,
    });
    expect(result.success).toBe(false);
  });
});
