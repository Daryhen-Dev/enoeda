/**
 * Payment validation action boundary and behavior tests.
 *
 * Follows the mocking pattern of actions.test.ts: server-only and
 * @/lib/auth/server-context are mocked; ./queries is mocked so the
 * branch-local "today" is deterministic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { dateOnlyToUtcDate } from "@/lib/date";
import { BRANCH_ASSERTION_MESSAGES } from "@/lib/auth/branch-assertion";
import { BRANCH_MESSAGES, COMMON_MESSAGES, PAYMENT_VALIDATION_MESSAGES } from "@/lib/localization/es-ec";

vi.mock("server-only", () => ({}));

const mockWithAuthenticatedUser = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

const TODAY = "2026-10-15";
const mockGetBranchLocalToday = vi.fn().mockResolvedValue(TODAY);
vi.mock("@/lib/domain/payments/queries", () => ({
  getBranchLocalToday: (...args: unknown[]) => mockGetBranchLocalToday(...args),
  normalizeEcuadorTimeZone: (timeZone: string | null | undefined) =>
    timeZone === "Pacific/Galapagos" ? "Pacific/Galapagos" : "America/Guayaquil",
}));

import {
  getMonthlyPaymentValidation,
  suspendOverdueEnrollments,
} from "./validation-actions";

const BRANCH_A = "aaaaaaaa-1111-4222-a333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-4222-a333-444444444444";
const USER_ID = "dddddddd-1111-4222-a333-444444444444";
const ENROLLMENT_1 = "cccccccc-1111-4222-a333-444444444444";
const ENROLLMENT_2 = "cccccccc-2222-4222-a333-444444444444";
const ENROLLMENT_3 = "cccccccc-3333-4222-a333-444444444444";
const ENROLLMENT_4 = "cccccccc-4444-4222-a333-444444444444";
const STUDENT_1 = "eeeeeeee-1111-4222-a333-444444444444";
const STUDENT_2 = "eeeeeeee-2222-4222-a333-444444444444";

type MockTx = ReturnType<typeof buildMockTx>;

function buildMockTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ payment_grace_days: 3, time_zone: "America/Guayaquil" }]),
    student_disciplines: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    discipline_events: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user_profiles: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

const ADMIN_CTX_A = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_A }],
};

const TEACHER_CTX_A = {
  userId: USER_ID,
  roles: ["teacher"],
  assignments: [{ role: "teacher", branchId: BRANCH_A }],
};

const ADMIN_CTX_B = {
  userId: USER_ID,
  roles: ["admin"],
  assignments: [{ role: "admin", branchId: BRANCH_B }],
};

type ActionOutcome = { success: boolean; data?: unknown; error?: string };

function assertFailure(result: ActionOutcome): string {
  expect(result.success).toBe(false);
  return result.error ?? "";
}

interface TestContext {
  userId: string;
  roles: string[];
  assignments: { role: string; branchId: string }[];
}

function setupWithAuth(ctx: TestContext, tx?: MockTx) {
  const mockTx = tx ?? buildMockTx();
  mockWithAuthenticatedUser.mockImplementation(
    async (
      fn: (tx: MockTx, ctx: TestContext) => Promise<unknown>,
      options?: { mapTransactionError?: (error: unknown) => string | undefined }
    ) => {
      try {
        const data = await fn(mockTx, ctx);
        return { success: true, data };
      } catch (error) {
        const mapped = options?.mapTransactionError?.(error);
        return { success: false, error: mapped ?? COMMON_MESSAGES.UNEXPECTED_ERROR };
      }
    }
  );
  return mockTx;
}

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_1,
    is_active: true,
    next_due_date: null,
    students: {
      id: STUDENT_1,
      first_name: "Ana",
      surname: "Pérez",
      branch_id: BRANCH_A,
      is_active: true,
      activation_status: "active",
    },
    disciplines: { name: "Piano" },
    ...overrides,
  };
}

describe("getMonthlyPaymentValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed input before authentication", async () => {
    const result = await getMonthlyPaymentValidation({ branch_id: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects a teacher caller", async () => {
    setupWithAuth(TEACHER_CTX_A);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(assertFailure(result)).toBe(BRANCH_ASSERTION_MESSAGES.CALLER_NOT_BRANCH_ADMIN);
  });

  it("rejects an admin of another branch", async () => {
    setupWithAuth(ADMIN_CTX_B);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(assertFailure(result)).toBe(BRANCH_ASSERTION_MESSAGES.CALLER_NOT_BRANCH_ADMIN);
  });

  it("fails when the branch is missing or inactive", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.$queryRaw = vi.fn().mockResolvedValue([]);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(assertFailure(result)).toBe(BRANCH_MESSAGES.INACTIVE_OR_NOT_FOUND);
  });

  it("groups enrollments and sorts to_suspend/in_grace by days overdue desc", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ id: ENROLLMENT_1, next_due_date: null }),
      enrollmentRow({
        id: ENROLLMENT_2,
        next_due_date: dateOnlyToUtcDate("2026-10-13"),
        students: { id: STUDENT_2, first_name: "Beto", surname: "Gómez" },
      }),
      enrollmentRow({ id: ENROLLMENT_3, next_due_date: dateOnlyToUtcDate("2026-10-10") }),
      enrollmentRow({ id: ENROLLMENT_4, next_due_date: dateOnlyToUtcDate("2026-10-01") }),
    ]);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.today).toBe(TODAY);
    expect(result.data.month).toBe("2026-10");
    expect(result.data.grace_days).toBe(3);
    expect(result.data.up_to_date.map((row) => row.student_discipline_id)).toEqual([ENROLLMENT_1]);
    expect(result.data.in_grace.map((row) => row.student_discipline_id)).toEqual([ENROLLMENT_2]);
    expect(result.data.in_grace[0].days_overdue).toBe(2);
    expect(result.data.to_suspend.map((row) => row.student_discipline_id)).toEqual([
      ENROLLMENT_4,
      ENROLLMENT_3,
    ]);
    expect(result.data.to_suspend[0].days_overdue).toBe(14);
    expect(result.data.to_suspend[1].days_overdue).toBe(5);
    expect(result.data.to_suspend[1].grace_deadline).toBe("2026-10-13");
  });

  it("returns this month's non-payment suspensions with profile names when readable", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.discipline_events.findMany = vi.fn().mockResolvedValue([
      {
        event_date: new Date("2026-10-05T15:30:00Z"),
        performed_by: USER_ID,
        student_discipline_id: ENROLLMENT_1,
        student_disciplines: {
          is_active: false,
          student_id: STUDENT_1,
          students: { first_name: "Ana", surname: "Pérez" },
          disciplines: { name: "Piano" },
        },
      },
      {
        event_date: new Date("2026-10-06T15:30:00Z"),
        performed_by: USER_ID,
        student_discipline_id: ENROLLMENT_2,
        student_disciplines: {
          is_active: true,
          student_id: STUDENT_2,
          students: { first_name: "Beto", surname: "Gómez" },
          disciplines: { name: "Guitarra" },
        },
      },
    ]);
    tx.user_profiles.findMany = vi
      .fn()
      .mockResolvedValue([{ user_id: USER_ID, first_name: "Carla", surname: "Ruiz" }]);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.suspended_this_month).toHaveLength(2);
    const [first, second] = result.data.suspended_this_month;
    expect(first.suspended_at).toBe("2026-10-05T15:30:00.000Z");
    expect(first.performed_by_name).toBe("Carla Ruiz");
    expect(first.currently_suspended).toBe(true);
    expect(second.currently_suspended).toBe(false);
    expect(tx.discipline_events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_type: "suspended",
          reason: "non_payment",
          event_date: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        }),
      })
    );
  });

  it("returns null performed_by_name when profiles are not readable", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.discipline_events.findMany = vi.fn().mockResolvedValue([
      {
        event_date: new Date("2026-10-05T15:30:00Z"),
        performed_by: USER_ID,
        student_discipline_id: ENROLLMENT_1,
        student_disciplines: {
          is_active: false,
          student_id: STUDENT_1,
          students: { first_name: "Ana", surname: "Pérez" },
          disciplines: { name: "Piano" },
        },
      },
    ]);
    // RLS only allows reading the caller's own profile; other rows vanish.
    tx.user_profiles.findMany = vi.fn().mockResolvedValue([]);

    const result = await getMonthlyPaymentValidation({ branch_id: BRANCH_A });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.suspended_this_month[0].performed_by_name).toBeNull();
  });
});

describe("suspendOverdueEnrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a teacher caller", async () => {
    setupWithAuth(TEACHER_CTX_A);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(BRANCH_ASSERTION_MESSAGES.CALLER_NOT_BRANCH_ADMIN);
  });

  it("rejects a cross-branch enrollment id", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ students: { ...enrollmentRow().students, branch_id: BRANCH_B } }),
    ]);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED);
    expect(tx.student_disciplines.updateMany).not.toHaveBeenCalled();
  });

  it("suspends overdue enrollments with an audit event in one transaction", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ id: ENROLLMENT_1, next_due_date: dateOnlyToUtcDate("2026-10-01") }),
      enrollmentRow({ id: ENROLLMENT_2, next_due_date: dateOnlyToUtcDate("2026-09-30") }),
    ]);
    tx.student_disciplines.updateMany = vi.fn().mockResolvedValue({ count: 2 });

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1, ENROLLMENT_2],
      notes: "Cobro pendiente",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.suspended_count).toBe(2);
    expect(tx.student_disciplines.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [ENROLLMENT_1, ENROLLMENT_2] }, is_active: true },
      data: { is_active: false, suspended_at: expect.any(Date) },
    });
    expect(tx.discipline_events.createMany).toHaveBeenCalledWith({
      data: [ENROLLMENT_1, ENROLLMENT_2].map((studentDisciplineId) => ({
        student_discipline_id: studentDisciplineId,
        event_type: "suspended",
        reason: "non_payment",
        performed_by: USER_ID,
        notes: "Cobro pendiente",
      })),
    });
  });

  it("suspends nothing when one enrollment is no longer overdue", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ id: ENROLLMENT_1, next_due_date: dateOnlyToUtcDate("2026-10-01") }),
      // Not overdue anymore: due date moved to today.
      enrollmentRow({ id: ENROLLMENT_2, next_due_date: dateOnlyToUtcDate("2026-10-15") }),
    ]);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1, ENROLLMENT_2],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(tx.student_disciplines.updateMany).not.toHaveBeenCalled();
    expect(tx.discipline_events.createMany).not.toHaveBeenCalled();
  });

  it("suspends nothing when one enrollment is still within grace", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      // 2 days overdue with 3 grace days -> in_grace.
      enrollmentRow({ next_due_date: dateOnlyToUtcDate("2026-10-13") }),
    ]);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(tx.student_disciplines.updateMany).not.toHaveBeenCalled();
  });

  it("suspends nothing when one enrollment is already suspended", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ is_active: false, next_due_date: dateOnlyToUtcDate("2026-10-01") }),
    ]);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(tx.student_disciplines.updateMany).not.toHaveBeenCalled();
  });

  it("suspends nothing when a requested enrollment does not exist", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    // Requested two ids, only one resolves.
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ next_due_date: dateOnlyToUtcDate("2026-10-01") }),
    ]);

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1, ENROLLMENT_2],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(tx.student_disciplines.updateMany).not.toHaveBeenCalled();
  });

  it("rolls back when the guarded update count does not match the request", async () => {
    const tx = setupWithAuth(ADMIN_CTX_A);
    tx.student_disciplines.findMany = vi.fn().mockResolvedValue([
      enrollmentRow({ next_due_date: dateOnlyToUtcDate("2026-10-01") }),
    ]);
    tx.student_disciplines.updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(tx.discipline_events.createMany).not.toHaveBeenCalled();
  });

  it("rejects an empty list at the schema boundary", async () => {
    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_LIST_EMPTY);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects a list larger than 200 at the schema boundary", async () => {
    const ids = Array.from({ length: 201 }, (_, index) =>
      `cccccccc-${String(index).padStart(4, "0")}-4222-a333-444444444444`
    );

    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: ids,
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_LIST_TOO_LONG);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid list entry at the schema boundary", async () => {
    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: ["not-a-uuid"],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_LIST_INVALID_ID);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects duplicated ids at the schema boundary", async () => {
    const result = await suspendOverdueEnrollments({
      branch_id: BRANCH_A,
      student_discipline_ids: [ENROLLMENT_1, ENROLLMENT_1],
    });

    expect(assertFailure(result)).toBe(PAYMENT_VALIDATION_MESSAGES.SUSPEND_LIST_DUPLICATED);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });
});
