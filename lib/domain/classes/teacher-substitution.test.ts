/**
 * Teacher substitution mutations — group-wide change, one-time class
 * teacher change and day-substitution clear.
 *
 * Covers:
 * - setClassSeriesTeacher: admin/owner gate, series branch scoping,
 *   RPC invocation with nullable teacher, RPC error mapping (invalid_teacher,
 *   class_series_not_found, unauthorized).
 * - setOneTimeClassTeacher: admin/owner gate, NOT_FOUND for foreign/absent
 *   classes, inactive rejection, active-teacher-role validation, null
 *   teacher allowed.
 * - clearSessionSubstitution: keeps the class_sessions row, clears only a
 *   real override, reports cleared=false otherwise.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  assignTeacherSchema,
  clearSessionSubstitutionSchema,
  setClassSeriesTeacherSchema,
  setOneTimeClassTeacherSchema,
} from "./schema";
import {
  clearSessionSubstitution,
  setClassSeriesTeacher,
  setOneTimeClassTeacher,
} from "./actions";
import { CLASS_MESSAGES, TEACHER_ASSIGN_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const ONE_TIME_ID = "77777777-8888-7777-8333-444444444444";
const CLASS_ID = "11111111-2222-3333-8444-555555555555";
const TEACHER_A = "dddddddd-1111-2222-8333-444444444444";

const mockTx = {
  scheduled_classes: {
    findUnique: vi.fn(),
  },
  class_series: {
    findFirst: vi.fn(),
  },
  one_time_classes: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user_roles: {
    findFirst: vi.fn(),
  },
  class_sessions: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

const OWNER_CTX = {
  userId: "owner-1",
  roles: ["owner"],
  assignments: [],
};

function setupAuth(ctx: unknown = OWNER_CTX) {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: typeof mockTx, ctx: unknown) => Promise<unknown>,
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

describe("Teacher substitution schemas", () => {
  describe("setClassSeriesTeacherSchema", () => {
    it("accepts a teacher_id uuid", () => {
      expect(
        setClassSeriesTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          series_id: SERIES_ID,
          teacher_id: TEACHER_A,
        }).success
      ).toBe(true);
    });

    it("accepts a null teacher_id (group without teacher)", () => {
      expect(
        setClassSeriesTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          series_id: SERIES_ID,
          teacher_id: null,
        }).success
      ).toBe(true);
    });

    it("rejects a missing teacher_id", () => {
      expect(
        setClassSeriesTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          series_id: SERIES_ID,
        }).success
      ).toBe(false);
    });

    it("rejects a missing series_id", () => {
      expect(
        setClassSeriesTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          teacher_id: TEACHER_A,
        }).success
      ).toBe(false);
    });
  });

  describe("setOneTimeClassTeacherSchema", () => {
    it("accepts a valid payload with a teacher", () => {
      expect(
        setOneTimeClassTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          one_time_class_id: ONE_TIME_ID,
          teacher_id: TEACHER_A,
        }).success
      ).toBe(true);
    });

    it("accepts a null teacher", () => {
      expect(
        setOneTimeClassTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          one_time_class_id: ONE_TIME_ID,
          teacher_id: null,
        }).success
      ).toBe(true);
    });

    it("rejects a missing one_time_class_id", () => {
      expect(
        setOneTimeClassTeacherSchema.safeParse({
          branch_id: BRANCH_A,
          teacher_id: TEACHER_A,
        }).success
      ).toBe(false);
    });
  });

  describe("clearSessionSubstitutionSchema", () => {
    it("accepts a valid payload", () => {
      expect(
        clearSessionSubstitutionSchema.safeParse({
          branch_id: BRANCH_A,
          scheduled_class_id: CLASS_ID,
          session_date: "2026-09-07",
        }).success
      ).toBe(true);
    });

    it("rejects a missing session_date", () => {
      expect(
        clearSessionSubstitutionSchema.safeParse({
          branch_id: BRANCH_A,
          scheduled_class_id: CLASS_ID,
        }).success
      ).toBe(false);
    });

    it("rejects an invalid session_date", () => {
      expect(
        clearSessionSubstitutionSchema.safeParse({
          branch_id: BRANCH_A,
          scheduled_class_id: CLASS_ID,
          session_date: "07/09/2026",
        }).success
      ).toBe(false);
    });
  });

  describe("assignTeacherSchema (session-only)", () => {
    it("accepts a session payload", () => {
      expect(
        assignTeacherSchema.safeParse({
          target_type: "session",
          scheduled_class_id: CLASS_ID,
          session_date: "2026-09-07",
          teacher_id: TEACHER_A,
          branch_id: BRANCH_A,
        }).success
      ).toBe(true);
    });

    it("rejects the removed recurring target", () => {
      expect(
        assignTeacherSchema.safeParse({
          target_type: "recurring",
          scheduled_class_id: CLASS_ID,
          teacher_id: TEACHER_A,
          branch_id: BRANCH_A,
        }).success
      ).toBe(false);
    });
  });
});

describe("setClassSeriesTeacher behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.class_series.findFirst.mockResolvedValue({ id: SERIES_ID });
    mockTx.$queryRaw.mockResolvedValue([
      { result: { updatedClassCount: 3, cutoff: "2026-09-11T12:00:00+00:00" } },
    ]);
  });

  it("calls the RPC inside the RLS transaction and maps updatedClassCount", async () => {
    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: true, data: { updated_class_count: 3 } });
    expect(mockTx.class_series.findFirst).toHaveBeenCalledWith({
      where: { id: SERIES_ID, branch_id: BRANCH_A },
      select: { id: true },
    });
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("allows a null teacher (group without teacher) and still calls the RPC", async () => {
    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: null,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ updated_class_count: 3 });
    expect(mockTx.user_roles.findFirst).not.toHaveBeenCalled();
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("fails with NOT_FOUND when the series is foreign or absent (no RPC)", async () => {
    mockTx.class_series.findFirst.mockResolvedValue(null);

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a caller who is neither owner nor branch admin (teacher caller)", async () => {
    setupAuth({
      userId: "teacher-1",
      roles: [],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.class_series.findFirst).not.toHaveBeenCalled();
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects an admin of a different branch", async () => {
    setupAuth({
      userId: "admin-b",
      roles: [],
      assignments: [{ role: "admin", branchId: "bbbbbbbb-1111-2222-8333-444444444444" }],
    });

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
  });

  it("maps the RPC invalid_teacher error to the es-EC message", async () => {
    mockTx.$queryRaw.mockRejectedValue(
      new Error("invalid_teacher: teacher must have an active teacher role in this branch")
    );

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.INVALID_TEACHER,
    });
  });

  it("maps the RPC class_series_not_found error to the NOT_FOUND message", async () => {
    mockTx.$queryRaw.mockRejectedValue(new Error("class_series_not_found"));

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
  });

  it("maps the RPC unauthorized error to the es-EC message", async () => {
    mockTx.$queryRaw.mockRejectedValue(
      new Error("unauthorized: insufficient privileges")
    );

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await setClassSeriesTeacher({
      branch_id: BRANCH_A,
      series_id: SERIES_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.class_series.findFirst).not.toHaveBeenCalled();
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("setOneTimeClassTeacher behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.one_time_classes.findFirst.mockResolvedValue({
      id: ONE_TIME_ID,
      is_active: true,
    });
    mockTx.one_time_classes.update.mockResolvedValue({ id: ONE_TIME_ID });
    mockTx.user_roles.findFirst.mockResolvedValue({ user_id: TEACHER_A });
  });

  it("updates the teacher of a one-time class in the caller's branch", async () => {
    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: true, data: { id: ONE_TIME_ID } });
    expect(mockTx.one_time_classes.update).toHaveBeenCalledWith({
      where: { id: ONE_TIME_ID },
      data: { teacher_id: TEACHER_A },
      select: { id: true },
    });
  });

  it("allows a null teacher without any role lookup", async () => {
    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: null,
    });

    expect(result).toEqual({ success: true, data: { id: ONE_TIME_ID } });
    expect(mockTx.user_roles.findFirst).not.toHaveBeenCalled();
    expect(mockTx.one_time_classes.update).toHaveBeenCalledWith({
      where: { id: ONE_TIME_ID },
      data: { teacher_id: null },
      select: { id: true },
    });
  });

  it("validates the teacher holds an active teacher role in the branch", async () => {
    mockTx.user_roles.findFirst.mockResolvedValue(null);

    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.INVALID_TEACHER,
    });
    expect(mockTx.user_roles.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: TEACHER_A,
        role: "teacher",
        branch_id: BRANCH_A,
        revoked_at: null,
      },
      select: { user_id: true },
    });
    expect(mockTx.one_time_classes.update).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND when the class is foreign or absent", async () => {
    mockTx.one_time_classes.findFirst.mockResolvedValue(null);

    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.one_time_classes.update).not.toHaveBeenCalled();
  });

  it("rejects an inactive one-time class", async () => {
    mockTx.one_time_classes.findFirst.mockResolvedValue({
      id: ONE_TIME_ID,
      is_active: false,
    });

    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.one_time_classes.update).not.toHaveBeenCalled();
  });

  it("rejects a caller who is neither owner nor branch admin", async () => {
    setupAuth({
      userId: "teacher-1",
      roles: [],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.one_time_classes.findFirst).not.toHaveBeenCalled();
    expect(mockTx.one_time_classes.update).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await setOneTimeClassTeacher({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      teacher_id: TEACHER_A,
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.one_time_classes.findFirst).not.toHaveBeenCalled();
    expect(mockTx.one_time_classes.update).not.toHaveBeenCalled();
  });
});

describe("clearSessionSubstitution behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBranch.mockReturnValue({ ok: true });
    setupAuth();
    mockTx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
    });
    mockTx.class_sessions.findUnique.mockResolvedValue({
      id: "session-1",
      assigned_teacher_id: TEACHER_A,
    });
    mockTx.class_sessions.update.mockResolvedValue({ id: "session-1" });
  });

  it("clears the override but keeps the class_sessions row", async () => {
    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({ success: true, data: { cleared: true } });
    expect(mockTx.class_sessions.findUnique).toHaveBeenCalledWith({
      where: {
        scheduled_class_id_session_date: {
          scheduled_class_id: CLASS_ID,
          session_date: new Date("2026-09-07"),
        },
      },
      select: { id: true, assigned_teacher_id: true },
    });
    expect(mockTx.class_sessions.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { assigned_teacher_id: null },
    });
  });

  it("reports cleared=false without writing when there was no override", async () => {
    mockTx.class_sessions.findUnique.mockResolvedValue({
      id: "session-1",
      assigned_teacher_id: null,
    });

    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({ success: true, data: { cleared: false } });
    expect(mockTx.class_sessions.update).not.toHaveBeenCalled();
  });

  it("reports cleared=false without writing when the occurrence was never materialized", async () => {
    mockTx.class_sessions.findUnique.mockResolvedValue(null);

    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({ success: true, data: { cleared: false } });
    expect(mockTx.class_sessions.update).not.toHaveBeenCalled();
  });

  it("fails with NOT_FOUND when the class is foreign or absent", async () => {
    mockTx.scheduled_classes.findUnique.mockResolvedValue(null);

    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({ success: false, error: CLASS_MESSAGES.NOT_FOUND });
    expect(mockTx.class_sessions.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a caller who is neither owner nor branch admin", async () => {
    setupAuth({
      userId: "teacher-1",
      roles: [],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });

    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
    expect(mockTx.class_sessions.findUnique).not.toHaveBeenCalled();
    expect(mockTx.class_sessions.update).not.toHaveBeenCalled();
  });

  it("short-circuits without any DB access when the branch guard fails", async () => {
    mockAssertBranch.mockReturnValue({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });

    const result = await clearSessionSubstitution({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: "2026-09-07",
    });

    expect(result).toEqual({
      success: false,
      error: CLASS_MESSAGES.BRANCH_CONTEXT_REQUIRED,
    });
    expect(mockTx.scheduled_classes.findUnique).not.toHaveBeenCalled();
    expect(mockTx.class_sessions.findUnique).not.toHaveBeenCalled();
  });
});
