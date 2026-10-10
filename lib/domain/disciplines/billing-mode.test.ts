/**
 * Billing mode behavior tests (T8):
 * - enrollStudentSchema defaults to 'monthly' and validates the mode
 * - enrollStudent stores the requested billing mode
 * - setEnrollmentBillingMode: admin/owner guard, branch mismatch, roster
 *   cleanup scoped to current/future rosters, next_due_date cleared,
 *   audit event recorded, idempotent no-op when the mode is unchanged
 * - suspendEnrollment removes the student from current/future rosters and
 *   reports removed_roster_entries without breaking existing callers
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BRANCH_ASSERTION_MESSAGES } from "@/lib/auth/branch-assertion";
import { ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";
import {
  enrollStudentSchema,
  setEnrollmentBillingModeSchema,
} from "./schema";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/domain/payments/queries", () => ({
  getBranchLocalToday: vi.fn().mockResolvedValue("2026-10-15"),
}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

import {
  enrollStudent,
  setEnrollmentBillingMode,
  suspendEnrollment,
} from "./actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";
const DISCIPLINE_ID = "dddddddd-1111-4222-a333-444444444444";
const ENROLLMENT_ID = "eeeeeeee-1111-4222-a333-444444444444";
const USER_ID = "ffffffff-1111-4222-a333-444444444444";
const SERIES_ID = "11111111-2222-4222-a333-444444444444";
const ONE_TIME_ID = "22222222-3333-4222-a333-444444444444";

const CURRENT_MONTH_START = new Date("2026-10-01T00:00:00.000Z");
const TODAY_UTC = new Date("2026-10-15T00:00:00.000Z");

function buildMockTx() {
  return {
    students: {
      findUnique: vi.fn().mockResolvedValue({ branch_id: BRANCH_A }),
    },
    student_disciplines: {
      findUnique: vi.fn(),
      create: vi
        .fn()
        .mockResolvedValue({ id: ENROLLMENT_ID, disciplines: { initial_level_id: null } }),
      update: vi.fn().mockResolvedValue({}),
    },
    discipline_events: {
      create: vi.fn().mockResolvedValue({}),
    },
    student_progress: {
      create: vi.fn().mockResolvedValue({}),
    },
    class_series: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    one_time_classes: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    class_series_students: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    one_time_class_students: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

interface AuthOverrides {
  roles?: string[];
  assignments?: Array<{ role: string; branchId: string | null }>;
}

function setupAuth(overrides: AuthOverrides = {}, tx = buildMockTx()) {
  mockWithAuth.mockImplementation(
    async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => {
      const ctx = {
        userId: USER_ID,
        roles: overrides.roles ?? ["admin"],
        assignments:
          overrides.assignments ?? [{ role: "admin", branchId: BRANCH_A }],
      };
      const data = await fn(tx, ctx);
      return { success: true, data };
    }
  );
  return tx;
}

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    student_id: STUDENT_ID,
    discipline_id: DISCIPLINE_ID,
    is_active: true,
    billing_mode: "monthly",
    students: { branch_id: BRANCH_A },
    ...overrides,
  };
}

describe("Billing mode schema", () => {
  it("defaults enrollStudentSchema billing_mode to 'monthly'", () => {
    const parsed = enrollStudentSchema.safeParse({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.billing_mode).toBe("monthly");
    }
  });

  it("accepts 'per_class' as an explicit billing mode", () => {
    const parsed = enrollStudentSchema.safeParse({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
      billing_mode: "per_class",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.billing_mode).toBe("per_class");
    }
  });

  it("rejects unknown billing modes", () => {
    const parsed = enrollStudentSchema.safeParse({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
      billing_mode: "weekly",
    });
    expect(parsed.success).toBe(false);
  });

  it("setEnrollmentBillingModeSchema requires branch, enrollment and mode", () => {
    expect(
      setEnrollmentBillingModeSchema.safeParse({
        branch_id: BRANCH_A,
        student_discipline_id: ENROLLMENT_ID,
        billing_mode: "per_class",
      }).success
    ).toBe(true);
    expect(
      setEnrollmentBillingModeSchema.safeParse({
        student_discipline_id: ENROLLMENT_ID,
        billing_mode: "per_class",
      }).success
    ).toBe(false);
    expect(
      setEnrollmentBillingModeSchema.safeParse({
        branch_id: BRANCH_A,
        student_discipline_id: ENROLLMENT_ID,
        billing_mode: "weekly",
      }).success
    ).toBe(false);
  });
});

describe("enrollStudent — stores the billing mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores 'per_class' when requested", async () => {
    const tx = setupAuth();

    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
      billing_mode: "per_class",
    });

    expect(result.success).toBe(true);
    expect(tx.student_disciplines.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ billing_mode: "per_class" }),
      })
    );
  });

  it("stores 'monthly' by default", async () => {
    const tx = setupAuth();

    const result = await enrollStudent({
      student_id: STUDENT_ID,
      discipline_ids: [DISCIPLINE_ID],
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    expect(tx.student_disciplines.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ billing_mode: "monthly" }),
      })
    );
  });
});

describe("setEnrollmentBillingMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a caller who is neither branch admin nor owner", async () => {
    const tx = setupAuth({
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(enrollmentRow());

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "per_class",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ENROLLMENT_MESSAGES.BILLING_MODE_UNAUTHORIZED);
    expect(tx.student_disciplines.update).not.toHaveBeenCalled();
  });

  it("allows an owner without a branch-admin assignment", async () => {
    const tx = setupAuth({ roles: ["owner"], assignments: [] });
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue({
      ...enrollmentRow(),
      billing_mode: "per_class",
    });

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "monthly",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an enrollment that belongs to another branch", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(
      enrollmentRow({ students: { branch_id: BRANCH_B } })
    );

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "per_class",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED);
    expect(tx.student_disciplines.update).not.toHaveBeenCalled();
  });

  it("switching monthly -> per_class removes current/future roster rows, clears next_due_date and audits the change", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(enrollmentRow());
    tx.class_series.findMany = vi
      .fn()
      .mockResolvedValue([{ id: SERIES_ID }]);
    tx.one_time_classes.findMany = vi
      .fn()
      .mockResolvedValue([{ id: ONE_TIME_ID }]);
    tx.class_series_students.deleteMany = vi
      .fn()
      .mockResolvedValue({ count: 2 });
    tx.one_time_class_students.deleteMany = vi
      .fn()
      .mockResolvedValue({ count: 1 });

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "per_class",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data!.removed_roster_entries).toBe(3);
      expect(result.data!.billing_mode).toBe("per_class");
    }

    expect(tx.class_series.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_ID,
        period_month: { gte: CURRENT_MONTH_START },
      },
      select: { id: true },
    });
    expect(tx.one_time_classes.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_ID,
        class_date: { gte: TODAY_UTC },
      },
      select: { id: true },
    });
    expect(tx.class_series_students.deleteMany).toHaveBeenCalledWith({
      where: { series_id: { in: [SERIES_ID] }, student_id: STUDENT_ID },
    });
    expect(tx.one_time_class_students.deleteMany).toHaveBeenCalledWith({
      where: { one_time_class_id: { in: [ONE_TIME_ID] }, student_id: STUDENT_ID },
    });
    expect(tx.student_disciplines.update).toHaveBeenCalledWith({
      where: { id: ENROLLMENT_ID },
      data: { billing_mode: "per_class", next_due_date: null },
    });
    expect(tx.discipline_events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        student_discipline_id: ENROLLMENT_ID,
        event_type: "billing_mode_changed",
        reason: "per_class",
      }),
    });
  });

  it("switching per_class -> monthly keeps next_due_date NULL and touches no rosters", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(
      enrollmentRow({ billing_mode: "per_class" })
    );

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "monthly",
    });

    expect(result.success).toBe(true);
    expect(tx.student_disciplines.update).toHaveBeenCalledWith({
      where: { id: ENROLLMENT_ID },
      data: { billing_mode: "monthly", next_due_date: null },
    });
    expect(tx.class_series_students.deleteMany).not.toHaveBeenCalled();
    expect(tx.one_time_class_students.deleteMany).not.toHaveBeenCalled();
    expect(tx.discipline_events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: "billing_mode_changed",
        reason: "monthly",
      }),
    });
  });

  it("is a no-op when the enrollment already has the requested mode", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(
      enrollmentRow({ billing_mode: "per_class" })
    );

    const result = await setEnrollmentBillingMode({
      branch_id: BRANCH_A,
      student_discipline_id: ENROLLMENT_ID,
      billing_mode: "per_class",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data!.removed_roster_entries).toBe(0);
    }
    expect(tx.student_disciplines.update).not.toHaveBeenCalled();
    expect(tx.class_series_students.deleteMany).not.toHaveBeenCalled();
    expect(tx.one_time_class_students.deleteMany).not.toHaveBeenCalled();
    expect(tx.discipline_events.create).not.toHaveBeenCalled();
  });
});

describe("suspendEnrollment — roster cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the student from current/future rosters and reports the count", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(enrollmentRow());
    tx.class_series.findMany = vi
      .fn()
      .mockResolvedValue([{ id: SERIES_ID }]);
    tx.class_series_students.deleteMany = vi
      .fn()
      .mockResolvedValue({ count: 4 });

    const result = await suspendEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data!.id).toBe(ENROLLMENT_ID);
      expect(result.data!.removed_roster_entries).toBe(4);
    }
    expect(tx.class_series.findMany).toHaveBeenCalledWith({
      where: {
        discipline_id: DISCIPLINE_ID,
        period_month: { gte: CURRENT_MONTH_START },
      },
      select: { id: true },
    });
    expect(tx.class_series_students.deleteMany).toHaveBeenCalledWith({
      where: { series_id: { in: [SERIES_ID] }, student_id: STUDENT_ID },
    });
    expect(tx.student_disciplines.update).toHaveBeenCalledWith({
      where: { id: ENROLLMENT_ID },
      data: { is_active: false, suspended_at: expect.any(Date) },
    });
  });

  it("reports zero removed entries when the discipline has no current/future rosters", async () => {
    const tx = setupAuth();
    tx.student_disciplines.findUnique = vi.fn().mockResolvedValue(enrollmentRow());

    const result = await suspendEnrollment({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_A,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data!.removed_roster_entries).toBe(0);
    }
    expect(tx.class_series_students.deleteMany).not.toHaveBeenCalled();
    expect(tx.one_time_class_students.deleteMany).not.toHaveBeenCalled();
  });
});
