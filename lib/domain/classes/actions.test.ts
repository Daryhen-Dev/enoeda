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
  createScheduledClass,
  createScheduledClassBatch,
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

function makeSeriesRow(overrides: {
  series_id: string;
  is_active: boolean;
  day_of_week: number;
  default_teacher_id?: string | null;
  discipline_name?: string;
}) {
  return {
    series_id: overrides.series_id,
    is_active: overrides.is_active,
    day_of_week: overrides.day_of_week,
    default_teacher_id:
      overrides.default_teacher_id === undefined
        ? TEACHER_A
        : overrides.default_teacher_id,
    start_time: new Date(1970, 0, 1, 17, 0),
    disciplines: {
      id: DISCIPLINE_A,
      name: overrides.discipline_name ?? "Karate",
    },
  };
}

const mockTx = {
  scheduled_classes: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  class_series: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
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

describe("createScheduledClassBatch behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
  });

  it("inserts the named class_series row first, then day rows sharing its series_id", async () => {
    mockTx.class_series.create.mockResolvedValue({ id: SERIES_ID });
    mockTx.scheduled_classes.create.mockImplementation(
      ({ data }: { data: { day_of_week: number } }) =>
        Promise.resolve({ id: `row-${data.day_of_week}` })
    );

    const result = await createScheduledClassBatch({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_A,
      days_of_week: [1, 3],
      start_time: "17:00",
      series_name: "Karate infantil",
    });

    expect(result).toEqual({
      success: true,
      data: {
        created: [
          { day_of_week: 1, id: "row-1" },
          { day_of_week: 3, id: "row-3" },
        ],
        failed: [],
      },
    });
    expect(mockTx.class_series.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        branch_id: BRANCH_A,
        name: "Karate infantil",
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
    // Every day row shares the series identity stamped on the catalog row.
    expect(firstCall.data.series_id).toBe(seriesCreateCall.data.id);
    expect(secondCall.data.series_id).toBe(seriesCreateCall.data.id);
  });

  it("creates NO day rows when the class_series insert fails", async () => {
    mockTx.class_series.create.mockRejectedValue(
      new Error(CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED)
    );

    const result = await createScheduledClassBatch({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_A,
      days_of_week: [1],
      start_time: "17:00",
      series_name: "Karate infantil",
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("rejects an empty series name via the schema (no writes)", async () => {
    const result = await createScheduledClassBatch({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_A,
      days_of_week: [1],
      start_time: "17:00",
      series_name: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(CLASS_MESSAGES.SERIES_NAME_REQUIRED);
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });
});

describe("createScheduledClass behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
  });

  it("autogenerates the 1-row series name from discipline + weekday + time", async () => {
    mockTx.disciplines.findUnique.mockResolvedValue({ name: "Karate" });
    mockTx.class_series.create.mockResolvedValue({ id: SERIES_ID });
    mockTx.scheduled_classes.create.mockResolvedValue({ id: CLASS_ID });

    const result = await createScheduledClass({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_A,
      day_of_week: 1,
      start_time: "17:00",
    });

    expect(result).toEqual({ success: true, data: { id: CLASS_ID } });
    expect(mockTx.class_series.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        branch_id: BRANCH_A,
        name: `Karate — Martes 17:00`,
      },
      select: { id: true },
    });
    const classCreateCall = mockTx.scheduled_classes.create.mock.calls[0][0] as {
      data: { series_id: string };
    };
    const seriesCreateCall = mockTx.class_series.create.mock.calls[0][0] as {
      data: { id: string };
    };
    expect(classCreateCall.data.series_id).toBe(seriesCreateCall.data.id);
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

  it("groups rows per series with days/teacher from ACTIVE rows and flags fully inactive series", async () => {
    mockTx.class_series.findMany.mockResolvedValue([
      { id: SERIES_ID, name: "Karate — 17:00" },
      { id: SERIES_B_ID, name: "Yoga — 08:00" },
    ]);
    mockTx.scheduled_classes.findMany.mockResolvedValue([
      makeSeriesRow({ series_id: SERIES_ID, is_active: true, day_of_week: 1 }),
      makeSeriesRow({ series_id: SERIES_ID, is_active: true, day_of_week: 3 }),
      makeSeriesRow({
        series_id: SERIES_B_ID,
        is_active: false,
        day_of_week: 2,
        default_teacher_id: null,
        discipline_name: "Yoga",
      }),
    ]);

    const result = await listClassSeries({ branch_id: BRANCH_A });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      {
        series_id: SERIES_ID,
        name: "Karate — 17:00",
        discipline_id: DISCIPLINE_A,
        discipline_name: "Karate",
        days_of_week: [1, 3],
        start_time: "17:00",
        default_teacher_id: TEACHER_A,
        teacher_name: "María Pérez",
        active_row_count: 2,
        is_all_inactive: false,
      },
      {
        series_id: SERIES_B_ID,
        name: "Yoga — 08:00",
        discipline_id: DISCIPLINE_A,
        discipline_name: "Yoga",
        days_of_week: [],
        start_time: "17:00",
        default_teacher_id: null,
        teacher_name: null,
        active_row_count: 0,
        is_all_inactive: true,
      },
    ]);
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
