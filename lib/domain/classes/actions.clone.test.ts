/**
 * cloneClassGroupToNextMonth — T5: clone a monthly class group into the
 * next month with its weekday slots and roster.
 *
 * Covers:
 * - Month rollover (2026-12 -> 2027-01) and returned "YYYY-MM"
 * - Only ACTIVE scheduled_classes rows are copied
 * - Roster copy with classifyRosterEligibility: eligible students are
 *   inserted (added_by = caller), the rest are skipped with reasons
 * - Already-cloned rejection (pre-check AND mapped unique-index violation)
 * - Inactive source, foreign series NOT_FOUND, NO_ACTIVE_SLOTS
 * - Teachers rejected (branch admin / owner only)
 * - deactivateAllFutureClasses group deactivation is covered in
 *   actions.test.ts
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mockWithAuth = vi.fn();
const mockAssertBranch = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({
  assertActiveBranchAssignment: (...args: unknown[]) =>
    mockAssertBranch(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: vi.fn() }),
}));

import {
  cloneClassGroupSchema,
  type CloneClassGroupInput,
} from "./schema";
import { cloneClassGroupToNextMonth } from "./actions";
import {
  CLASS_MESSAGES,
  CLONE_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-8333-444444444444";
const DISCIPLINE_A = "cccccccc-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const NEW_SERIES_ID = "99999999-8888-7777-8666-555555555556";
const TEACHER_A = "dddddddd-1111-2222-8333-444444444444";
const STUDENT_ELIGIBLE = "22222222-3333-4444-8555-666666666661";
const STUDENT_INACTIVE = "22222222-3333-4444-8555-666666666662";
const STUDENT_FOREIGN = "22222222-3333-4444-8555-666666666663";
const STUDENT_PER_CLASS = "22222222-3333-4444-8555-666666666664";

const SOURCE_SERIES = {
  id: SERIES_ID,
  branch_id: BRANCH_A,
  name: "Karate infantil",
  discipline_id: DISCIPLINE_A,
  default_teacher_id: TEACHER_A,
  period_month: new Date(Date.UTC(2026, 11, 1)),
  is_active: true,
};

const mockTx = {
  scheduled_classes: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  class_series: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  class_series_students: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  students: {
    findMany: vi.fn(),
  },
  student_disciplines: {
    findMany: vi.fn(),
  },
};

type Ctx = {
  userId: string;
  roles: string[];
  assignments: Array<{ role: string; branchId: string }>;
};

function setupAuth(ctx: Ctx = {
  userId: "user-1",
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_A }],
}) {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: typeof mockTx, ctx: Ctx) => Promise<unknown>,
      options?: {
        mapTransactionError?: (error: unknown) => string | undefined;
      }
    ) => {
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

/**
 * Wire the class_series.findFirst mock so it answers the SOURCE lookup
 * (where by id + branch) with `source` and the ALREADY-CLONED pre-check
 * (where by cloned_from_series_id) with `existingClone`.
 */
function setupSource(
  source: typeof SOURCE_SERIES = SOURCE_SERIES,
  existingClone: { id: string } | null = null
) {
  mockTx.class_series.findFirst.mockImplementation((args: {
    where: { cloned_from_series_id?: string };
  }) => {
    if (args.where.cloned_from_series_id) {
      return Promise.resolve(existingClone);
    }
    return Promise.resolve(source);
  });
}

function setupActiveRows(
  rows: Array<{
    day_of_week: number;
    start_time: Date;
    default_teacher_id: string | null;
  }> = [
    {
      day_of_week: 0,
      start_time: new Date("1970-01-01T17:00:00"),
      default_teacher_id: TEACHER_A,
    },
    {
      day_of_week: 2,
      start_time: new Date("1970-01-01T18:00:00"),
      default_teacher_id: null,
    },
  ]
) {
  mockTx.scheduled_classes.findMany.mockResolvedValue(rows);
  return rows;
}

describe("cloneClassGroupSchema", () => {
  it("accepts branch_id + series_id", () => {
    const parsed = cloneClassGroupSchema.safeParse({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    } satisfies CloneClassGroupInput);
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid series_id", () => {
    const result = cloneClassGroupSchema.safeParse({
      branch_id: BRANCH_A,
      series_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("cloneClassGroupToNextMonth behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true, branchId: BRANCH_A });
    setupAuth();
  });

  it("rolls 2026-12 over to 2027-01 and clones the group in one transaction", async () => {
    setupSource();
    setupActiveRows();
    mockTx.class_series.create.mockResolvedValue({ id: NEW_SERIES_ID });
    mockTx.scheduled_classes.create.mockResolvedValue({ id: "row-0" });
    mockTx.class_series_students.findMany.mockResolvedValue([]);

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: true,
      data: {
        series_id: NEW_SERIES_ID,
        period_month: "2027-01",
        class_ids: ["row-0", "row-0"],
        copied_student_count: 0,
        skipped: [],
      },
    });
    expect(mockTx.class_series.create).toHaveBeenCalledWith({
      data: {
        branch_id: BRANCH_A,
        name: "Karate infantil",
        discipline_id: DISCIPLINE_A,
        default_teacher_id: TEACHER_A,
        period_month: new Date(Date.UTC(2027, 0, 1)),
        cloned_from_series_id: SERIES_ID,
      },
      select: { id: true },
    });
  });

  it("copies ONLY the active weekday rows with day, time and teacher", async () => {
    setupSource();
    const activeRows = setupActiveRows();
    mockTx.class_series.create.mockResolvedValue({ id: NEW_SERIES_ID });
    mockTx.scheduled_classes.create.mockImplementation(
      ({ data }: { data: { day_of_week: number } }) =>
        Promise.resolve({ id: `row-${data.day_of_week}` })
    );
    mockTx.class_series_students.findMany.mockResolvedValue([]);

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: true,
      data: {
        series_id: NEW_SERIES_ID,
        period_month: "2027-01",
        class_ids: ["row-0", "row-2"],
        copied_student_count: 0,
        skipped: [],
      },
    });
    // Only ACTIVE rows of the source series are selected.
    expect(mockTx.scheduled_classes.findMany).toHaveBeenCalledWith({
      where: { series_id: SERIES_ID, branch_id: BRANCH_A, is_active: true },
      select: {
        day_of_week: true,
        start_time: true,
        default_teacher_id: true,
      },
    });
    // Each copied row inherits day, time, teacher and the NEW series id.
    expect(mockTx.scheduled_classes.create).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = mockTx.scheduled_classes.create.mock
      .calls as Array<[{ data: Record<string, unknown> }]>;
    expect(firstCall[0].data).toMatchObject({
      day_of_week: activeRows[0].day_of_week,
      start_time: activeRows[0].start_time,
      default_teacher_id: TEACHER_A,
      series_id: NEW_SERIES_ID,
    });
    expect(secondCall[0].data).toMatchObject({
      day_of_week: activeRows[1].day_of_week,
      start_time: activeRows[1].start_time,
      default_teacher_id: null,
      series_id: NEW_SERIES_ID,
    });
  });

  it("copies the roster: eligible students inserted, the rest skipped with reasons", async () => {
    setupSource();
    setupActiveRows();
    mockTx.class_series.create.mockResolvedValue({ id: NEW_SERIES_ID });
    mockTx.scheduled_classes.create.mockResolvedValue({ id: "row-0" });

    mockTx.class_series_students.findMany.mockResolvedValue([
      { student_id: STUDENT_ELIGIBLE },
      { student_id: STUDENT_INACTIVE },
      { student_id: STUDENT_FOREIGN },
      { student_id: STUDENT_PER_CLASS },
    ]);
    mockTx.students.findMany.mockResolvedValue([
      {
        id: STUDENT_ELIGIBLE,
        branch_id: BRANCH_A,
        is_active: true,
        first_name: "Ana",
        surname: "Zapata",
      },
      {
        id: STUDENT_INACTIVE,
        branch_id: BRANCH_A,
        is_active: false,
        first_name: "Bruno",
        surname: "Yánez",
      },
      {
        id: STUDENT_FOREIGN,
        branch_id: BRANCH_B,
        is_active: true,
        first_name: "Carla",
        surname: "Xavier",
      },
      {
        id: STUDENT_PER_CLASS,
        branch_id: BRANCH_A,
        is_active: true,
        first_name: "Diana",
        surname: "Wagner",
      },
    ]);
    mockTx.student_disciplines.findMany.mockResolvedValue([
      {
        student_id: STUDENT_ELIGIBLE,
        is_active: true,
        billing_mode: "monthly",
      },
      {
        student_id: STUDENT_PER_CLASS,
        is_active: true,
        billing_mode: "per_class",
      },
    ]);
    mockTx.class_series_students.createMany.mockResolvedValue({ count: 1 });

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: true,
      data: {
        series_id: NEW_SERIES_ID,
        period_month: "2027-01",
        class_ids: ["row-0", "row-0"],
        copied_student_count: 1,
        skipped: [
          {
            student_id: STUDENT_INACTIVE,
            first_name: "Bruno",
            surname: "Yánez",
            reason: "inactive",
          },
          {
            student_id: STUDENT_FOREIGN,
            first_name: "Carla",
            surname: "Xavier",
            reason: "branch_mismatch",
          },
          {
            student_id: STUDENT_PER_CLASS,
            first_name: "Diana",
            surname: "Wagner",
            reason: "not_eligible",
          },
        ],
      },
    });
    expect(mockTx.class_series_students.createMany).toHaveBeenCalledWith({
      data: [
        {
          series_id: NEW_SERIES_ID,
          student_id: STUDENT_ELIGIBLE,
          added_by: "user-1",
        },
      ],
    });
  });

  it("rejects with ALREADY_CLONED when the pre-check finds an existing clone (no writes)", async () => {
    setupSource(SOURCE_SERIES, { id: NEW_SERIES_ID });

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLONE_MESSAGES.ALREADY_CLONED,
    });
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("maps a race-induced unique-index violation to ALREADY_CLONED", async () => {
    setupSource();
    setupActiveRows();
    mockTx.class_series_students.findMany.mockResolvedValue([]);
    mockTx.class_series.create.mockRejectedValue(
      new Error(
        'Invalid `tx.class_series.create()` invocation:\n\nUnique constraint failed on the constraint: `class_series_cloned_from_series_id_uq`'
      )
    );

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLONE_MESSAGES.ALREADY_CLONED,
    });
  });

  it("rejects an inactive source with SOURCE_INACTIVE", async () => {
    setupSource({ ...SOURCE_SERIES, is_active: false });

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLONE_MESSAGES.SOURCE_INACTIVE,
    });
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND when the series is foreign or absent", async () => {
    setupSource();
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.NOT_FOUND,
    });
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("rejects with NO_ACTIVE_SLOTS when the source has no active weekday rows", async () => {
    setupSource();
    mockTx.scheduled_classes.findMany.mockResolvedValue([]);

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLONE_MESSAGES.NO_ACTIVE_SLOTS,
    });
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
    expect(mockTx.scheduled_classes.create).not.toHaveBeenCalled();
  });

  it("rejects teachers: only the branch admin (or owner) may clone", async () => {
    setupAuth({
      userId: "teacher-1",
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await cloneClassGroupToNextMonth({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
    });

    expect(result).toEqual({
      success: false,
      error: CLONE_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.class_series.findFirst).not.toHaveBeenCalled();
    expect(mockTx.class_series.create).not.toHaveBeenCalled();
  });

  it("renders the success summary through the es-EC helper", () => {
    expect(CLONE_MESSAGES.SUCCESS_SUMMARY("2027-01", 12, 3)).toBe(
      "Grupo clonado para 2027-01: 12 alumnos copiados, 3 omitidos."
    );
  });
});
