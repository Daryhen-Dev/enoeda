/**
 * Class mutations — branch context enforcement + series/all-future behavior.
 *
 * Covers scenarios S3.1–S3.8:
 * - Each mutation rejects on branch mismatch (NO write)
 * - Absent/null branchId rejected (fail-closed)
 * - branchId not in caller assignments rejected
 *
 * Schema tests use the zod schemas directly. Behavior tests for
 * deactivateScheduledClassSeries / deactivateAllFutureClasses use mock
 * withAuthenticatedUser to isolate branch guard behavior and the
 * series_id → updateMany / two-table updateMany flows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the schemas directly to test validation
import {
  updateScheduledClassSchema,
  deactivateScheduledClassSchema,
  deactivateScheduledClassSeriesSchema,
  deactivateAllFutureClassesSchema,
  suspendSessionSchema,
  reinstateSessionSchema,
  assignTeacherSchema,
} from "@/lib/domain/classes/schema";

vi.mock("server-only", () => ({}));
const mockWithAuth = vi.fn();
const mockAssertBranch = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({
  assertActiveBranchAssignment: (...args: unknown[]) => mockAssertBranch(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({}) }),
}));

import {
  deactivateScheduledClassSeries,
  deactivateAllFutureClasses,
} from "./actions";
import { CLASS_MESSAGES } from "@/lib/localization/es-ec";
import { parseDateOnly } from "@/lib/date";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const DISCIPLINE_A = "cccccccc-1111-2222-8333-444444444444";
const CLASS_ID = "11111111-2222-3333-8444-555555555555";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";

const mockTx = {
  scheduled_classes: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  one_time_classes: {
    updateMany: vi.fn(),
  },
};

function setupAuth() {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: typeof mockTx, ctx: unknown) => Promise<unknown>,
      options?: {
        mapTransactionError?: (error: unknown) => string | undefined;
      }
    ) => {
      const ctx = {
        userId: "u1",
        roles: ["admin"],
        assignments: [{ role: "admin", branchId: BRANCH_A }],
      };
      try {
        const data = await fn(mockTx, ctx);
        return { success: true, data };
      } catch (error) {
        const mapped = options?.mapTransactionError?.(error);
        return {
          success: false,
          error: mapped ?? "Ocurrió un error inesperado.",
        };
      }
    }
  );
}

describe("Schema branch_id enforcement (fail-closed)", () => {
  describe("updateScheduledClassSchema", () => {
    it("rejects when branch_id is absent", () => {
      const result = updateScheduledClassSchema.safeParse({
        id: CLASS_ID,
        // no branch_id — should fail after our change makes it required
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid branch_id", () => {
      const result = updateScheduledClassSchema.safeParse({
        id: CLASS_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deactivateScheduledClassSchema", () => {
    it("rejects when branch_id is absent", () => {
      const result = deactivateScheduledClassSchema.safeParse({
        id: CLASS_ID,
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid branch_id", () => {
      const result = deactivateScheduledClassSchema.safeParse({
        id: CLASS_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid branch_id format", () => {
      const result = deactivateScheduledClassSchema.safeParse({
        id: CLASS_ID,
        branch_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deactivateScheduledClassSeriesSchema", () => {
    it("accepts a series payload keyed by scheduled_class_id", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
        scheduled_class_id: CLASS_ID,
      });
      expect(result.success).toBe(true);
    });

    it("rejects when scheduled_class_id is absent", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });

    it("rejects the obsolete discipline_id + start_time shape", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
        discipline_id: DISCIPLINE_A,
        start_time: "17:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid branch_id format", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: "not-a-uuid",
        scheduled_class_id: CLASS_ID,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid scheduled_class_id format", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
        scheduled_class_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deactivateAllFutureClassesSchema", () => {
    it("accepts a valid branch_id", () => {
      const result = deactivateAllFutureClassesSchema.safeParse({
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });

    it("rejects when branch_id is absent", () => {
      const result = deactivateAllFutureClassesSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid branch_id format", () => {
      const result = deactivateAllFutureClassesSchema.safeParse({
        branch_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("suspendSessionSchema", () => {
    it("rejects when branch_id is absent", () => {
      const result = suspendSessionSchema.safeParse({
        scheduled_class_id: CLASS_ID,
        session_date: "2026-09-01",
        suspension_category: "feriado",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid branch_id", () => {
      const result = suspendSessionSchema.safeParse({
        scheduled_class_id: CLASS_ID,
        session_date: "2026-09-01",
        suspension_category: "feriado",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("reinstateSessionSchema", () => {
    it("rejects when branch_id is absent", () => {
      const result = reinstateSessionSchema.safeParse({
        scheduled_class_id: CLASS_ID,
        session_date: "2026-09-01",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid branch_id", () => {
      const result = reinstateSessionSchema.safeParse({
        scheduled_class_id: CLASS_ID,
        session_date: "2026-09-01",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("assignTeacherSchema", () => {
    it("rejects when branch_id is absent", () => {
      const result = assignTeacherSchema.safeParse({
        target_type: "recurring",
        scheduled_class_id: CLASS_ID,
        teacher_id: "22222222-3333-4444-8555-666666666666",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid branch_id", () => {
      const result = assignTeacherSchema.safeParse({
        target_type: "recurring",
        scheduled_class_id: CLASS_ID,
        teacher_id: "22222222-3333-4444-8555-666666666666",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("deactivateScheduledClassSeries behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
  });

  it("resolves the series_id from the row, then updateMany-scopes to the series", async () => {
    mockTx.scheduled_classes.findFirst.mockResolvedValue({
      series_id: SERIES_ID,
    });
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 3 });

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toEqual({ success: true, data: { deactivated: 3 } });
    expect(mockTx.scheduled_classes.findFirst).toHaveBeenCalledWith({
      where: { id: CLASS_ID, branch_id: BRANCH_A },
      select: { series_id: true },
    });
    expect(mockTx.scheduled_classes.updateMany).toHaveBeenCalledWith({
      where: { branch_id: BRANCH_A, series_id: SERIES_ID, is_active: true },
      data: { is_active: false },
    });
  });

  it("fails with NOT_FOUND when the row does not exist (no update)", async () => {
    mockTx.scheduled_classes.findFirst.mockResolvedValue(null);

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.scheduled_classes.updateMany).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND when the row has a null series_id (no update)", async () => {
    mockTx.scheduled_classes.findFirst.mockResolvedValue({ series_id: null });

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.scheduled_classes.updateMany).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.scheduled_classes.findFirst).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.updateMany).not.toHaveBeenCalled();
  });
});

describe("deactivateAllFutureClasses behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
  });

  it("soft-deactivates both tables and returns both counts", async () => {
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 4 });
    mockTx.one_time_classes.updateMany.mockResolvedValue({ count: 2 });

    const result = await deactivateAllFutureClasses({ branch_id: BRANCH_A });

    expect(result).toEqual({
      success: true,
      data: { recurring: 4, oneTime: 2 },
    });
    expect(mockTx.scheduled_classes.updateMany).toHaveBeenCalledWith({
      where: { branch_id: BRANCH_A, is_active: true },
      data: { is_active: false },
    });
    expect(mockTx.one_time_classes.updateMany).toHaveBeenCalledWith({
      where: {
        branch_id: BRANCH_A,
        is_active: true,
        class_date: { gte: expect.any(Date) },
      },
      data: { is_active: false },
    });
  });

  it("bounds the one-time update to today onward (server-local)", async () => {
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 0 });
    mockTx.one_time_classes.updateMany.mockResolvedValue({ count: 0 });

    await deactivateAllFutureClasses({ branch_id: BRANCH_A });

    const call = mockTx.one_time_classes.updateMany.mock.calls[0][0] as {
      where: { class_date: { gte: Date } };
    };
    const todayStr = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
    })();
    const expected = parseDateOnly(todayStr);
    // Same local-midnight instant the resolver pipeline produces.
    expect(call.where.class_date.gte.getTime()).toBe(expected.getTime());
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await deactivateAllFutureClasses({ branch_id: BRANCH_A });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.scheduled_classes.updateMany).not.toHaveBeenCalled();
    expect(mockTx.one_time_classes.updateMany).not.toHaveBeenCalled();
  });
});
