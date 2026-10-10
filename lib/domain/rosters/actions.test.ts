/**
 * Roster actions — branch guards, eligibility classification and batch
 * behavior for monthly class groups (class_series) and one-time classes.
 *
 * Covers the delegated T4 scenarios:
 * - Guard rejection short-circuits without any DB access
 * - Foreign/absent target resolves to ROSTER_MESSAGES.NOT_FOUND (no writes)
 * - Eligibility classification: per_class, inactive enrollment, inactive
 *   student, other branch, missing enrollment
 * - Batch add: eligible students inserted in one transaction with added_by,
 *   bad students skipped individually instead of aborting the batch;
 *   trigger-error message prefixes are mapped as a safety net
 * - Remove: deleteMany scoped to target + student, never touches attendance
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addStudentsToRosterSchema,
  listClassRosterSchema,
  listRosterCandidatesSchema,
  removeStudentFromRosterSchema,
} from "@/lib/domain/rosters/schema";
import { classifyRosterEligibility } from "@/lib/domain/rosters/eligibility";

vi.mock("server-only", () => ({}));
const mockWithAuth = vi.fn();
const mockAssertBranch = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({
  assertActiveBranchAssignment: (...args: unknown[]) => mockAssertBranch(...args),
}));

import {
  addStudentsToRoster,
  listClassRoster,
  listRosterCandidates,
  removeStudentFromRoster,
} from "./actions";
import { CLASS_MESSAGES, ROSTER_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-8333-444444444444";
const DISCIPLINE_A = "cccccccc-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const ONE_TIME_ID = "88888888-7777-6666-8555-444444444444";
const USER_ID = "dddddddd-1111-2222-8333-444444444444";
const S_ELIGIBLE = "11111111-2222-3333-8444-555555555551";
const S_ASSIGNED = "11111111-2222-3333-8444-555555555552";
const S_INACTIVE = "11111111-2222-3333-8444-555555555553";
const S_PER_CLASS = "11111111-2222-3333-8444-555555555554";
const S_FOREIGN = "11111111-2222-3333-8444-555555555555";
const ADDED_AT = new Date("2026-09-10T12:00:00.000Z");

const mockTx = {
  class_series: {
    findFirst: vi.fn(),
  },
  one_time_classes: {
    findFirst: vi.fn(),
  },
  class_series_students: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  one_time_class_students: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  students: {
    findMany: vi.fn(),
  },
  student_disciplines: {
    findMany: vi.fn(),
  },
};

interface AuthOverrides {
  roles?: string[];
  assignments?: Array<{ role: string; branchId: string | null }>;
}

function setupAuth(overrides: AuthOverrides = {}) {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: typeof mockTx, ctx: unknown) => Promise<unknown>,
      options?: {
        mapTransactionError?: (error: unknown) => string | undefined;
      }
    ) => {
      const ctx = {
        userId: USER_ID,
        roles: overrides.roles ?? ["admin"],
        assignments: overrides.assignments ?? [
          { role: "admin", branchId: BRANCH_A },
        ],
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

describe("Schema", () => {
  describe("listClassRosterSchema (discriminated target)", () => {
    it("accepts a series target", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "series",
        series_id: SERIES_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });

    it("accepts a one_time target", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "one_time",
        one_time_class_id: ONE_TIME_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown kind", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "other",
        series_id: SERIES_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a series payload without series_id", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "series",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing branch_id", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "series",
        series_id: SERIES_ID,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid series_id format", () => {
      const result = listClassRosterSchema.safeParse({
        kind: "series",
        series_id: "not-a-uuid",
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("addStudentsToRosterSchema", () => {
    const validInput = {
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    };

    it("accepts a single student id", () => {
      const result = addStudentsToRosterSchema.safeParse({
        ...validInput,
        student_ids: [S_ELIGIBLE],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty student list", () => {
      const result = addStudentsToRosterSchema.safeParse({
        ...validInput,
        student_ids: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 100 student ids", () => {
      const result = addStudentsToRosterSchema.safeParse({
        ...validInput,
        student_ids: Array.from(
          { length: 101 },
          (_, i) =>
            `11111111-2222-3333-8444-${String(i).padStart(12, "0")}`
        ),
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicated student ids", () => {
      const result = addStudentsToRosterSchema.safeParse({
        ...validInput,
        student_ids: [S_ELIGIBLE, S_ELIGIBLE],
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid student id format", () => {
      const result = addStudentsToRosterSchema.safeParse({
        ...validInput,
        student_ids: ["not-a-uuid"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("listRosterCandidatesSchema", () => {
    const validInput = {
      kind: "one_time",
      one_time_class_id: ONE_TIME_ID,
      branch_id: BRANCH_A,
    };

    it("accepts an optional search string", () => {
      const result = listRosterCandidatesSchema.safeParse({
        ...validInput,
        search: "Ana",
      });
      expect(result.success).toBe(true);
    });

    it("accepts input without search", () => {
      const result = listRosterCandidatesSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects a search string over 100 characters", () => {
      const result = listRosterCandidatesSchema.safeParse({
        ...validInput,
        search: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("removeStudentFromRosterSchema", () => {
    it("accepts a valid payload", () => {
      const result = removeStudentFromRosterSchema.safeParse({
        kind: "series",
        series_id: SERIES_ID,
        branch_id: BRANCH_A,
        student_id: S_ELIGIBLE,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing student_id", () => {
      const result = removeStudentFromRosterSchema.safeParse({
        kind: "series",
        series_id: SERIES_ID,
        branch_id: BRANCH_A,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("classifyRosterEligibility (pure)", () => {
  const activeStudent = {
    student_id: S_ELIGIBLE,
    branch_id: BRANCH_A,
    is_active: true,
  };
  const monthlyEnrollment = {
    is_active: true,
    billing_mode: "monthly",
  };

  it("classifies an active student with an active monthly enrollment as eligible", () => {
    expect(
      classifyRosterEligibility(activeStudent, monthlyEnrollment, BRANCH_A)
    ).toBe("eligible");
  });

  it("classifies a per_class billing mode as not_eligible", () => {
    expect(
      classifyRosterEligibility(
        activeStudent,
        { ...monthlyEnrollment, billing_mode: "per_class" },
        BRANCH_A
      )
    ).toBe("not_eligible");
  });

  it("classifies an inactive enrollment as not_eligible", () => {
    expect(
      classifyRosterEligibility(
        activeStudent,
        { ...monthlyEnrollment, is_active: false },
        BRANCH_A
      )
    ).toBe("not_eligible");
  });

  it("classifies a missing enrollment as not_eligible", () => {
    expect(
      classifyRosterEligibility(activeStudent, null, BRANCH_A)
    ).toBe("not_eligible");
  });

  it("classifies an inactive student as inactive", () => {
    expect(
      classifyRosterEligibility(
        { ...activeStudent, is_active: false },
        monthlyEnrollment,
        BRANCH_A
      )
    ).toBe("inactive");
  });

  it("classifies a student of another branch as branch_mismatch", () => {
    expect(
      classifyRosterEligibility(
        { ...activeStudent, branch_id: BRANCH_B },
        monthlyEnrollment,
        BRANCH_A
      )
    ).toBe("branch_mismatch");
  });
});

describe("listClassRoster behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
    mockTx.one_time_classes.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
  });

  it("returns students ordered by surname then first_name, mapped to the view shape", async () => {
    mockTx.class_series_students.findMany.mockResolvedValue([
      {
        student_id: S_ELIGIBLE,
        created_at: ADDED_AT,
        students: {
          first_name: "Ana",
          surname: "Zapata",
          national_id: "1711111111",
        },
      },
      {
        student_id: S_ASSIGNED,
        created_at: ADDED_AT,
        students: {
          first_name: "Beto",
          surname: "Alvarez",
          national_id: "1722222222",
        },
      },
    ]);

    const result = await listClassRoster({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({
      success: true,
      data: {
        students: [
          {
            student_id: S_ELIGIBLE,
            first_name: "Ana",
            surname: "Zapata",
            national_id: "1711111111",
            added_at: ADDED_AT.toISOString(),
          },
          {
            student_id: S_ASSIGNED,
            first_name: "Beto",
            surname: "Alvarez",
            national_id: "1722222222",
            added_at: ADDED_AT.toISOString(),
          },
        ],
      },
    });
    expect(mockTx.class_series_students.findMany).toHaveBeenCalledWith({
      where: { series_id: SERIES_ID },
      select: {
        student_id: true,
        created_at: true,
        students: {
          select: { first_name: true, surname: true, national_id: true },
        },
      },
      orderBy: [
        { students: { surname: "asc" } },
        { students: { first_name: "asc" } },
      ],
    });
  });

  it("reads the one_time roster table for a one_time target", async () => {
    mockTx.one_time_class_students.findMany.mockResolvedValue([]);

    const result = await listClassRoster({
      kind: "one_time",
      one_time_class_id: ONE_TIME_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({ success: true, data: { students: [] } });
    expect(mockTx.one_time_class_students.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { one_time_class_id: ONE_TIME_ID } })
    );
    expect(mockTx.class_series_students.findMany).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await listClassRoster({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.class_series.findFirst).not.toHaveBeenCalled();
    expect(mockTx.class_series_students.findMany).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND for a foreign or absent target", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await listClassRoster({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.NOT_FOUND,
    });
    expect(mockTx.class_series_students.findMany).not.toHaveBeenCalled();
  });
});

describe("listRosterCandidates behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
  });

  it("returns active branch students with an active monthly enrollment who are not on the roster yet", async () => {
    mockTx.class_series_students.findMany.mockResolvedValue([
      { student_id: S_ASSIGNED },
    ]);
    mockTx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_ASSIGNED },
      { student_id: S_ELIGIBLE },
    ]);
    mockTx.students.findMany.mockResolvedValue([
      {
        id: S_ELIGIBLE,
        first_name: "Ana",
        surname: "Zapata",
        national_id: "1711111111",
      },
    ]);

    const result = await listRosterCandidates({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({
      success: true,
      data: {
        students: [
          {
            student_id: S_ELIGIBLE,
            first_name: "Ana",
            surname: "Zapata",
            national_id: "1711111111",
          },
        ],
      },
    });
    expect(mockTx.student_disciplines.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_A,
        is_active: true,
        billing_mode: "monthly",
      },
      select: { student_id: true },
    });
    expect(mockTx.students.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [S_ELIGIBLE] },
          branch_id: BRANCH_A,
          is_active: true,
        },
        orderBy: [
          { surname: "asc" },
          { first_name: "asc" },
        ],
        take: 50,
      })
    );
  });

  it("matches the search case-insensitively on first_name, surname and national_id", async () => {
    mockTx.class_series_students.findMany.mockResolvedValue([]);
    mockTx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_ELIGIBLE },
    ]);
    mockTx.students.findMany.mockResolvedValue([]);

    await listRosterCandidates({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
      search: "  ana  ",
    });

    expect(mockTx.students.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [S_ELIGIBLE] },
          branch_id: BRANCH_A,
          is_active: true,
          OR: [
            { first_name: { contains: "ana", mode: "insensitive" } },
            { surname: { contains: "ana", mode: "insensitive" } },
            { national_id: { contains: "ana", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("returns no students when every enrolled student is already on the roster", async () => {
    mockTx.class_series_students.findMany.mockResolvedValue([
      { student_id: S_ELIGIBLE },
    ]);
    mockTx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_ELIGIBLE },
    ]);

    const result = await listRosterCandidates({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({ success: true, data: { students: [] } });
    expect(mockTx.students.findMany).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND for a foreign target", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await listRosterCandidates({
      kind: "series",
      series_id: SERIES_ID,
      branch_id: BRANCH_A,
    });

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.NOT_FOUND,
    });
    expect(mockTx.student_disciplines.findMany).not.toHaveBeenCalled();
  });
});

describe("addStudentsToRoster behavior", () => {
  const validInput = {
    kind: "series",
    series_id: SERIES_ID,
    branch_id: BRANCH_A,
    student_ids: [S_ELIGIBLE, S_ASSIGNED, S_INACTIVE, S_PER_CLASS, S_FOREIGN],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
    mockTx.class_series_students.createMany.mockResolvedValue({ count: 1 });
    // All requested students exist; eligibility differences come from
    // branch/active/enrollment data below.
    mockTx.students.findMany.mockResolvedValue([
      { id: S_ELIGIBLE, branch_id: BRANCH_A, is_active: true },
      { id: S_ASSIGNED, branch_id: BRANCH_A, is_active: true },
      { id: S_INACTIVE, branch_id: BRANCH_A, is_active: false },
      { id: S_PER_CLASS, branch_id: BRANCH_A, is_active: true },
      { id: S_FOREIGN, branch_id: BRANCH_B, is_active: true },
    ]);
    mockTx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_ELIGIBLE, is_active: true, billing_mode: "monthly" },
      { student_id: S_ASSIGNED, is_active: true, billing_mode: "monthly" },
      { student_id: S_PER_CLASS, is_active: true, billing_mode: "per_class" },
    ]);
    mockTx.class_series_students.findMany.mockResolvedValue([
      { student_id: S_ASSIGNED },
    ]);
  });

  it("adds eligible students in one batch and skips the rest individually", async () => {
    const result = await addStudentsToRoster(validInput);

    expect(result).toEqual({
      success: true,
      data: {
        added: [S_ELIGIBLE],
        skipped: [
          { student_id: S_ASSIGNED, reason: "already_assigned" },
          { student_id: S_INACTIVE, reason: "inactive" },
          { student_id: S_PER_CLASS, reason: "not_eligible" },
          { student_id: S_FOREIGN, reason: "branch_mismatch" },
        ],
      },
    });
    expect(mockTx.class_series_students.createMany).toHaveBeenCalledTimes(1);
    expect(mockTx.class_series_students.createMany).toHaveBeenCalledWith({
      data: [
        {
          series_id: SERIES_ID,
          student_id: S_ELIGIBLE,
          added_by: USER_ID,
        },
      ],
    });
  });

  it("maps a trigger rejection message prefix as a safety net", async () => {
    mockTx.class_series_students.createMany.mockRejectedValue(
      new Error(
        "roster_student_not_eligible: student X has no active monthly enrollment"
      )
    );

    const result = await addStudentsToRoster({
      ...validInput,
      student_ids: [S_ELIGIBLE],
    });

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.SKIPPED_NOT_ELIGIBLE,
    });
  });

  it("rejects a teacher (non-admin) write with UNAUTHORIZED", async () => {
    setupAuth({
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await addStudentsToRoster({
      ...validInput,
      student_ids: [S_ELIGIBLE],
    });

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.class_series_students.createMany).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await addStudentsToRoster(validInput);

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.class_series.findFirst).not.toHaveBeenCalled();
    expect(mockTx.class_series_students.createMany).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND for a foreign target (no writes)", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await addStudentsToRoster(validInput);

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.NOT_FOUND,
    });
    expect(mockTx.class_series_students.createMany).not.toHaveBeenCalled();
  });

  it("writes to the one_time roster table for a one_time target", async () => {
    mockTx.one_time_classes.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
    mockTx.one_time_class_students.findMany.mockResolvedValue([]);
    mockTx.one_time_class_students.createMany.mockResolvedValue({ count: 1 });

    const result = await addStudentsToRoster({
      kind: "one_time",
      one_time_class_id: ONE_TIME_ID,
      branch_id: BRANCH_A,
      student_ids: [S_ELIGIBLE],
    });

    expect(result).toEqual({
      success: true,
      data: { added: [S_ELIGIBLE], skipped: [] },
    });
    expect(mockTx.one_time_class_students.createMany).toHaveBeenCalledWith({
      data: [
        {
          one_time_class_id: ONE_TIME_ID,
          student_id: S_ELIGIBLE,
          added_by: USER_ID,
        },
      ],
    });
    expect(mockTx.class_series_students.createMany).not.toHaveBeenCalled();
  });
});

describe("removeStudentFromRoster behavior", () => {
  const validInput = {
    kind: "series",
    series_id: SERIES_ID,
    branch_id: BRANCH_A,
    student_id: S_ELIGIBLE,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.findFirst.mockResolvedValue({
      discipline_id: DISCIPLINE_A,
    });
  });

  it("removes the roster row scoped to target + student and reports removed=true", async () => {
    mockTx.class_series_students.deleteMany.mockResolvedValue({ count: 1 });

    const result = await removeStudentFromRoster(validInput);

    expect(result).toEqual({ success: true, data: { removed: true } });
    expect(mockTx.class_series_students.deleteMany).toHaveBeenCalledWith({
      where: { series_id: SERIES_ID, student_id: S_ELIGIBLE },
    });
  });

  it("reports removed=false when the student was not on the roster", async () => {
    mockTx.class_series_students.deleteMany.mockResolvedValue({ count: 0 });

    const result = await removeStudentFromRoster(validInput);

    expect(result).toEqual({ success: true, data: { removed: false } });
  });

  it("fails with NOT_FOUND for a foreign target (no delete)", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await removeStudentFromRoster(validInput);

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.NOT_FOUND,
    });
    expect(mockTx.class_series_students.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a teacher write with UNAUTHORIZED", async () => {
    setupAuth({
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await removeStudentFromRoster(validInput);

    expect(result).toEqual({
      success: false,
      error: ROSTER_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.class_series_students.deleteMany).not.toHaveBeenCalled();
  });
});
