/**
 * Class mutations — branch context enforcement + monthly group behavior.
 *
 * Covers scenarios S3.1–S3.8:
 * - Each mutation rejects on branch mismatch (NO write)
 * - Absent/null branchId rejected (fail-closed)
 * - branchId not in caller assignments rejected
 *
 * Schema tests use the zod schemas directly. Behavior tests for
 * deactivateScheduledClassSeries / deactivateAllFutureClasses /
 * createMonthlyClassGroup / assignTeacher use mock withAuthenticatedUser
 * to isolate branch guard behavior and the transaction flows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the schemas directly to test validation
import {
  createMonthlyClassGroupSchema,
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
const mockAdminFrom = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({
  assertActiveBranchAssignment: (...args: unknown[]) => mockAssertBranch(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}));

import {
  createMonthlyClassGroup,
  assignTeacher,
  deactivateScheduledClassSeries,
  deactivateAllFutureClasses,
  listClassSeries,
  renameClassSeries,
} from "./actions";
import { CLASS_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const DISCIPLINE_A = "cccccccc-1111-2222-8333-444444444444";
const CLASS_ID = "11111111-2222-3333-8444-555555555555";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const SERIES_B_ID = "99999999-8888-7777-8666-555555555556";
const TEACHER_A = "dddddddd-1111-2222-8333-444444444444";

const mockTx = {
  scheduled_classes: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  class_series: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  class_series_students: {
    groupBy: vi.fn(),
  },
  class_sessions: {
    upsert: vi.fn(),
  },
  one_time_classes: {
    updateMany: vi.fn(),
  },
  disciplines: {
    findUnique: vi.fn(),
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

    it("accepts a series payload keyed by series_id (concurrencias section)", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
        series_id: SERIES_ID,
      });
      expect(result.success).toBe(true);
    });

    it("rejects when both ids are given", () => {
      const result = deactivateScheduledClassSeriesSchema.safeParse({
        branch_id: BRANCH_A,
        scheduled_class_id: CLASS_ID,
        series_id: SERIES_ID,
      });
      expect(result.success).toBe(false);
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

    it("accepts valid branch_id without a force flag", () => {
      const result = assignTeacherSchema.safeParse({
        target_type: "recurring",
        scheduled_class_id: CLASS_ID,
        teacher_id: "22222222-3333-4444-8555-666666666666",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a session target without session_date", () => {
      const result = assignTeacherSchema.safeParse({
        target_type: "session",
        scheduled_class_id: CLASS_ID,
        teacher_id: "22222222-3333-4444-8555-666666666666",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("createMonthlyClassGroupSchema", () => {
  const validInput = {
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_A,
    series_name: "Karate infantil",
    period_month: "2026-09",
    days_of_week: [1, 3],
    start_time: "17:00",
  };

  it("accepts a valid monthly group payload", () => {
    const result = createMonthlyClassGroupSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts an optional null default_teacher_id", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      default_teacher_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid month format", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      period_month: "2026-13",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a full date instead of a month", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      period_month: "2026-09-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate weekdays", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      days_of_week: [1, 1, 3],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty weekday list", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      days_of_week: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range weekday", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      days_of_week: [7],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty series name via the schema (no writes)", () => {
    const result = createMonthlyClassGroupSchema.safeParse({
      ...validInput,
      series_name: "   ",
    });
    expect(result.success).toBe(false);
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
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

  it("deactivates directly by series_id without a row lookup (concurrencias section)", async () => {
    mockTx.class_series.findFirst.mockResolvedValue({ id: SERIES_ID });
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 2 });

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({ success: true, data: { deactivated: 2 } });
    expect(mockTx.class_series.findFirst).toHaveBeenCalledWith({
      where: { id: SERIES_ID, branch_id: BRANCH_A },
      select: { id: true },
    });
    expect(mockTx.scheduled_classes.findFirst).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.updateMany).toHaveBeenCalledWith({
      where: { branch_id: BRANCH_A, series_id: SERIES_ID, is_active: true },
      data: { is_active: false },
    });
  });

  it("also deactivates the class_series group itself", async () => {
    mockTx.class_series.findFirst.mockResolvedValue({ id: SERIES_ID });
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 2 });
    mockTx.class_series.updateMany.mockResolvedValue({ count: 1 });

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({ success: true, data: { deactivated: 2 } });
    expect(mockTx.class_series.updateMany).toHaveBeenCalledWith({
      where: { id: SERIES_ID, branch_id: BRANCH_A, is_active: true },
      data: { is_active: false },
    });
  });

  it("fails with NOT_FOUND when the given series_id is foreign or absent", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await deactivateScheduledClassSeries({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.scheduled_classes.updateMany).not.toHaveBeenCalled();
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

  it("soft-deactivates ONLY recurring templates and returns the count", async () => {
    mockTx.scheduled_classes.updateMany.mockResolvedValue({ count: 4 });

    const result = await deactivateAllFutureClasses({ branch_id: BRANCH_A });

    expect(result).toEqual({ success: true, data: { deactivated: 4 } });
    expect(mockTx.scheduled_classes.updateMany).toHaveBeenCalledWith({
      where: { branch_id: BRANCH_A, is_active: true },
      data: { is_active: false },
    });
    // "Quitar todo lo futuro" targets recurring series only — one-time
    // classes must remain untouched (is_active stays unused there).
    expect(mockTx.one_time_classes.updateMany).not.toHaveBeenCalled();
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

describe("createMonthlyClassGroup behavior", () => {
  const validInput = {
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_A,
    series_name: "Karate infantil",
    period_month: "2026-09",
    days_of_week: [1, 3],
    start_time: "17:00",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.create.mockResolvedValue({ id: SERIES_ID });
    mockTx.scheduled_classes.create.mockImplementation(
      ({ data }: { data: { day_of_week: number } }) =>
        Promise.resolve({ id: `row-${data.day_of_week}` })
    );
  });

  it("creates the group and one weekday row per day in ONE transaction, all-or-nothing", async () => {
    const result = await createMonthlyClassGroup(validInput);

    expect(result).toEqual({
      success: true,
      data: { series_id: expect.any(String), class_ids: ["row-1", "row-3"] },
    });
    expect(mockWithAuth).toHaveBeenCalledTimes(1);
    expect(mockTx.class_series.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        branch_id: BRANCH_A,
        name: "Karate infantil",
        discipline_id: DISCIPLINE_A,
        default_teacher_id: null,
        period_month: new Date(Date.UTC(2026, 8, 1)),
      },
      select: { id: true },
    });
    expect(mockTx.scheduled_classes.create).toHaveBeenCalledTimes(2);
    const firstCall = mockTx.scheduled_classes.create.mock.calls[0][0] as {
      data: { series_id: string };
    };
    const secondCall = mockTx.scheduled_classes.create.mock.calls[1][0] as {
      data: { series_id: string };
    };
    const seriesCreateCall = mockTx.class_series.create.mock.calls[0][0] as {
      data: { id: string };
    };
    // Every weekday row belongs to the group stamped on the catalog row.
    expect(firstCall.data.series_id).toBe(seriesCreateCall.data.id);
    expect(secondCall.data.series_id).toBe(seriesCreateCall.data.id);
    expect(result.data!.series_id).toBe(seriesCreateCall.data.id);
  });

  it("stores period_month as the FIRST day of the given month (UTC midnight)", async () => {
    await createMonthlyClassGroup({ ...validInput, period_month: "2026-02" });

    const call = mockTx.class_series.create.mock.calls[0][0] as {
      data: { period_month: Date };
    };
    expect(call.data.period_month).toEqual(new Date(Date.UTC(2026, 1, 1)));
  });

  it("propagates the default teacher to the group AND every weekday row", async () => {
    await createMonthlyClassGroup({
      ...validInput,
      default_teacher_id: TEACHER_A,
    });

    const seriesCall = mockTx.class_series.create.mock.calls[0][0] as {
      data: { default_teacher_id: string | null };
    };
    expect(seriesCall.data.default_teacher_id).toBe(TEACHER_A);
    const rowCalls = mockTx.scheduled_classes.create.mock.calls as Array<
      [{ data: { default_teacher_id: string | null } }]
    >;
    for (const call of rowCalls) {
      expect(call[0].data.default_teacher_id).toBe(TEACHER_A);
    }
  });

  it("creates NO weekday rows when the class_series insert fails", async () => {
    mockTx.class_series.create.mockRejectedValue(
      new Error(CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED)
    );

    const result = await createMonthlyClassGroup(validInput);

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid month via the schema (no writes)", async () => {
    const result = await createMonthlyClassGroup({
      ...validInput,
      period_month: "2099-00",
    });

    expect(result.success).toBe(false);
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate weekdays via the schema (no writes)", async () => {
    const result = await createMonthlyClassGroup({
      ...validInput,
      days_of_week: [1, 1],
    });

    expect(result.success).toBe(false);
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await createMonthlyClassGroup(validInput);

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });
});

describe("assignTeacher behavior (no conflict path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
    });
    mockTx.scheduled_classes.update.mockResolvedValue({ id: CLASS_ID });
    mockTx.class_sessions.upsert.mockResolvedValue({ id: CLASS_ID });
  });

  it("assigns a recurring teacher directly and never returns conflict data", async () => {
    const result = await assignTeacher({
      target_type: "recurring",
      scheduled_class_id: CLASS_ID,
      teacher_id: TEACHER_A,
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      teacher_assigned: true,
      message: expect.any(String),
    });
    const data = result.data as Record<string, unknown> | undefined;
    expect(data).not.toHaveProperty("conflict");
    expect(data).not.toHaveProperty("conflicting_assignments");
    expect(data).not.toHaveProperty("requires_confirmation");
    expect(mockTx.scheduled_classes.update).toHaveBeenCalledWith({
      where: { id: CLASS_ID },
      data: { default_teacher_id: TEACHER_A },
    });
    expect(mockTx.class_sessions.upsert).not.toHaveBeenCalled();
  });

  it("assigns a session-level override directly (upsert)", async () => {
    const result = await assignTeacher({
      target_type: "session",
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
      teacher_id: TEACHER_A,
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    expect(mockTx.class_sessions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduled_class_id_session_date: {
            scheduled_class_id: CLASS_ID,
            session_date: new Date("2026-09-07"),
          },
        },
      })
    );
    expect(mockTx.scheduled_classes.update).not.toHaveBeenCalled();
  });
});

describe("listClassSeries behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table !== "user_profiles") return {};
      return {
        select: () => ({
          in: async () => ({
            data: [
              { user_id: TEACHER_A, first_name: "María", surname: "Pérez" },
            ],
            error: null,
          }),
        }),
      };
    });
  });

  it("returns monthly-group views with discipline, month, active state and roster count", async () => {
    mockTx.class_series.findMany.mockResolvedValue([
      {
        id: SERIES_ID,
        name: "Karate — 17:00",
        is_active: true,
        period_month: new Date(Date.UTC(2026, 8, 1)),
        default_teacher_id: TEACHER_A,
        disciplines: { id: DISCIPLINE_A, name: "Karate" },
      },
      {
        id: SERIES_B_ID,
        name: "Yoga — 08:00",
        is_active: false,
        period_month: new Date(Date.UTC(2026, 9, 1)),
        default_teacher_id: null,
        disciplines: { id: DISCIPLINE_A, name: "Yoga" },
      },
    ]);
    mockTx.scheduled_classes.findMany.mockResolvedValue([
      {
        series_id: SERIES_ID,
        is_active: true,
        day_of_week: 1,
        default_teacher_id: TEACHER_A,
        start_time: new Date(1970, 0, 1, 17, 0),
      },
      {
        series_id: SERIES_ID,
        is_active: true,
        day_of_week: 3,
        default_teacher_id: TEACHER_A,
        start_time: new Date(1970, 0, 1, 17, 0),
      },
      {
        series_id: SERIES_B_ID,
        is_active: false,
        day_of_week: 2,
        default_teacher_id: null,
        start_time: new Date(1970, 0, 1, 8, 0),
      },
    ]);
    mockTx.class_series_students.groupBy.mockResolvedValue([
      { series_id: SERIES_ID, _count: { _all: 5 } },
    ]);

    const result = await listClassSeries({ branch_id: BRANCH_A });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      {
        series_id: SERIES_ID,
        name: "Karate — 17:00",
        discipline_id: DISCIPLINE_A,
        discipline_name: "Karate",
        period_month: "2026-09",
        days_of_week: [1, 3],
        start_time: "17:00",
        default_teacher_id: TEACHER_A,
        teacher_name: "María Pérez",
        active_row_count: 2,
        is_active: true,
        is_all_inactive: false,
        roster_student_count: 5,
      },
      {
        series_id: SERIES_B_ID,
        name: "Yoga — 08:00",
        discipline_id: DISCIPLINE_A,
        discipline_name: "Yoga",
        period_month: "2026-10",
        days_of_week: [],
        start_time: "08:00",
        default_teacher_id: null,
        teacher_name: null,
        active_row_count: 0,
        is_active: false,
        is_all_inactive: true,
        roster_student_count: 0,
      },
    ]);
  });

  it("accepts an optional period_month filter and scopes the series query to it", async () => {
    mockTx.class_series.findMany.mockResolvedValue([]);
    mockTx.scheduled_classes.findMany.mockResolvedValue([]);
    mockTx.class_series_students.groupBy.mockResolvedValue([]);

    await listClassSeries({ branch_id: BRANCH_A, period_month: "2026-09" });

    expect(mockTx.class_series.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branch_id: BRANCH_A,
          period_month: new Date(Date.UTC(2026, 8, 1)),
        },
      })
    );
  });

  it("rejects an invalid period_month filter via the schema", async () => {
    const result = await listClassSeries({
      branch_id: BRANCH_A,
      period_month: "2026-13",
    });
    expect(result.success).toBe(false);
    expect(mockTx.class_series.findMany).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await listClassSeries({ branch_id: BRANCH_A });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.class_series.findMany).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.findMany).not.toHaveBeenCalled();
  });
});

describe("renameClassSeries behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
  });

  it("updates the catalog row scoped to id + branch", async () => {
    mockTx.class_series.updateMany.mockResolvedValue({ count: 1 });

    const result = await renameClassSeries({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      name: "Nuevo nombre",
    });

    expect(result).toEqual({ success: true, data: { series_id: SERIES_ID } });
    expect(mockTx.class_series.updateMany).toHaveBeenCalledWith({
      where: { id: SERIES_ID, branch_id: BRANCH_A },
      data: { name: "Nuevo nombre" },
    });
  });

  it("fails with NOT_FOUND when no catalog row matches id + branch", async () => {
    mockTx.class_series.updateMany.mockResolvedValue({ count: 0 });

    const result = await renameClassSeries({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      name: "Nuevo nombre",
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
  });
});
