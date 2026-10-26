/**
 * T3/T4 — `session_date` (and every occurrence filter built from it) reaches
 * Prisma as the UTC-midnight instant of its calendar day.
 *
 * Postgres `date` columns keep only the UTC calendar day of the instant they
 * receive, so a local-midnight `Date` stores the right day only on servers at
 * or west of UTC, and the old one-time-class path (`setHours(0,0,0,0)` over a
 * class_date that Prisma already returns as UTC midnight) was off by one day
 * on ANY server west of UTC. The assertions pin the exact instant with
 * `toISOString()`, so they fail on any machine, not only on an eastern one.
 *
 * Also pins the calendar-day guards that share this value (S3): a session
 * dated today is accepted, tomorrow is rejected as future, and the capture
 * window keeps its exact boundaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockWithAuth = vi.fn();
vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuth(...args),
}));

vi.mock("@/lib/auth/branch-assertion", async () => {
  const actual = await vi.importActual("@/lib/auth/branch-assertion");
  return actual;
});

import {
  addPerClassStudentToSession,
  getPresentStudentsForSession,
  takeAttendance,
} from "./actions";
import { addGuestToSession, removeGuestFromSession } from "@/lib/domain/guests/actions";
import {
  ATTENDANCE_MESSAGES,
  COMMON_MESSAGES,
  GUEST_MESSAGES,
} from "@/lib/localization/es-ec";
import { CAPTURE_WINDOW_DAYS } from "./schema";
import type {
  AddPerClassStudentToSessionInput,
  AttendanceForSessionInput,
  TakeAttendanceInput,
} from "./schema";

const BRANCH_A = "aaaaaaaa-1111-4222-8333-444444444444";
const CLASS_ID = "cccccccc-1111-4222-8333-444444444444";
const ONE_TIME_ID = "8e8e8e8e-1111-4222-8333-444444444444";
const SERIES_ID = "99999999-1111-4222-8333-444444444444";
const DISCIPLINE_ID = "dddddddd-1111-4222-8333-444444444444";
const USER_ID = "eeeeeeee-1111-4222-8333-444444444444";
const STUDENT_ID = "11111111-2222-4333-8444-555555555551";
const ENROLLMENT_ID = "22222222-3333-4444-8555-666666666661";
const ATTENDANCE_ID = "33333333-4444-5555-8666-777777777771";
const GUEST_ID = "77777777-1111-4222-8333-444444444441";

/** Session day used by the instant assertions (a Monday, ISO day 0). */
const SESSION_DAY = "2026-10-26";
const SESSION_DAY_UTC = "2026-10-26T00:00:00.000Z";

/** Fixed "now": Monday 2026-10-26 10:00 in Ecuador (UTC-5). */
const NOW = new Date("2026-10-26T15:00:00.000Z");

/** JS getDay() → ISO day_of_week (0=Mon..6=Sun), as used by the actions. */
function isoDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** `daysAgo` days before the fixed now, as YYYY-MM-DD (UTC calendar day). */
function dayAt(daysAgo: number): string {
  const d = new Date(NOW.getTime() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

function makeMockTx() {
  return {
    $queryRaw: vi.fn(),
    scheduled_classes: { findUnique: vi.fn() },
    one_time_classes: { findUnique: vi.fn() },
    class_sessions: { findUnique: vi.fn() },
    class_series_students: { findMany: vi.fn() },
    one_time_class_students: { findMany: vi.fn() },
    attendance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    student_disciplines: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    students: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    class_payments: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    class_guests: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    student_progress: { findMany: vi.fn().mockResolvedValue([]) },
    disciplines: { findUnique: vi.fn() },
  };
}

type MockTx = ReturnType<typeof makeMockTx>;

function setupAuth(tx: MockTx, roles: string[] = ["admin"]) {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: MockTx, ctx: unknown) => Promise<unknown>,
      options?: { mapTransactionError?: (error: unknown) => string | undefined }
    ) => {
      const ctx = {
        userId: USER_ID,
        roles,
        assignments: [{ role: roles[0], branchId: BRANCH_A }],
      };
      try {
        const data = await fn(tx, ctx);
        return { success: true, data };
      } catch (error) {
        const mapped = options?.mapTransactionError?.(error);
        return {
          success: false,
          error: mapped ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
        };
      }
    }
  );
}

/** Authorize a recurring session; `dayOfWeek` defaults to the real weekday. */
function authorizeScheduled(
  tx: MockTx,
  sessionDay: string = SESSION_DAY,
  dayOfWeek: number = isoDayOfWeek(sessionDay)
) {
  tx.scheduled_classes.findUnique.mockResolvedValue({
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_ID,
    day_of_week: dayOfWeek,
    series_id: SERIES_ID,
  });
  tx.$queryRaw.mockResolvedValue([{ teacher_id: USER_ID }]);
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

/** Authorize a one-time class whose `class_date` Prisma returns as UTC midnight. */
function authorizeOneTime(tx: MockTx, classDate: Date) {
  tx.one_time_classes.findUnique.mockResolvedValue({
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_ID,
    class_date: classDate,
    teacher_id: USER_ID,
  });
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

/** The instant every call of `attendance.findMany` filtered `session_date` by. */
function attendanceFilterInstants(tx: MockTx): string[] {
  return tx.attendance.findMany.mock.calls
    .map((call) => call[0]?.where?.session_date)
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.toISOString());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recurring session_date reaches Prisma as UTC midnight (T3)", () => {
  it("takeAttendance writes and filters session_date as the UTC instant", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx);
    tx.class_series_students.findMany.mockResolvedValue([
      { student_id: STUDENT_ID },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: SESSION_DAY,
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(true);
    const written = tx.attendance.create.mock.calls[0][0].data.session_date as Date;
    expect(written.toISOString()).toBe(SESSION_DAY_UTC);
    // Every filter built from the same value is the same instant.
    expect(attendanceFilterInstants(tx)).toEqual([
      SESSION_DAY_UTC,
      SESSION_DAY_UTC,
    ]);
  });

  it("getPresentStudentsForSession filters session_date and resolve_effective_teacher by the UTC instant", async () => {
    const tx = makeMockTx();
    setupAuth(tx, ["teacher"]);
    authorizeScheduled(tx);
    tx.attendance.findMany.mockResolvedValue([]);

    const result = await getPresentStudentsForSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: SESSION_DAY,
    } as AttendanceForSessionInput);

    expect(result.success).toBe(true);
    expect(attendanceFilterInstants(tx)).toEqual([SESSION_DAY_UTC]);
    // $queryRaw is called as a template tag: (strings, ...values).
    const rawArgs = tx.$queryRaw.mock.calls[0] as unknown[];
    expect(
      rawArgs
        .filter((value): value is Date => value instanceof Date)
        .map((value) => value.toISOString())
    ).toEqual([SESSION_DAY_UTC]);
  });

  it("listPresent-style one-time read keeps filtering by class kind only", async () => {
    // PRESERVE: one-time attendance has no session_date filter (the class id
    // already identifies its date), so nothing about it changes.
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx, new Date(SESSION_DAY_UTC));
    tx.attendance.findMany.mockResolvedValue([]);

    const result = await getPresentStudentsForSession({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
    } as AttendanceForSessionInput);

    expect(result.success).toBe(true);
    expect(attendanceFilterInstants(tx)).toEqual([]);
  });
});

describe("one-time class_date reaches Prisma as its own UTC day (T3)", () => {
  it("takeAttendance writes session_date as 2026-10-26T00:00:00.000Z, not the shifted local midnight", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx, new Date(SESSION_DAY_UTC));
    tx.one_time_class_students.findMany.mockResolvedValue([
      { student_id: STUDENT_ID },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(true);
    const written = tx.attendance.create.mock.calls[0][0].data.session_date as Date;
    expect(written.toISOString()).toBe(SESSION_DAY_UTC);
  });

  it("addPerClassStudentToSession writes session_date as the UTC instant", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx, new Date(SESSION_DAY_UTC));
    tx.students.findUnique.mockResolvedValue({
      id: STUDENT_ID,
      branch_id: BRANCH_A,
      is_active: true,
    });
    tx.student_disciplines.findFirst.mockResolvedValue({
      id: ENROLLMENT_ID,
      disciplines: { class_price: null },
    });
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await addPerClassStudentToSession({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      student_id: STUDENT_ID,
      register_payment: false,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(true);
    const written = tx.attendance.create.mock.calls[0][0].data.session_date as Date;
    expect(written.toISOString()).toBe(SESSION_DAY_UTC);
  });
});

describe("guest session_date reaches Prisma as UTC midnight (T4)", () => {
  it("addGuestToSession writes a recurring session day as the UTC instant", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx);
    tx.class_guests.create.mockResolvedValue({ id: GUEST_ID });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: SESSION_DAY,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(true);
    const written = tx.class_guests.create.mock.calls[0][0].data.session_date as Date;
    expect(written.toISOString()).toBe(SESSION_DAY_UTC);
  });

  it("addGuestToSession writes a one-time class day as the UTC instant", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx, new Date(SESSION_DAY_UTC));
    tx.class_guests.create.mockResolvedValue({ id: GUEST_ID });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      first_name: "Luis",
      surname: "Gómez",
    });

    expect(result.success).toBe(true);
    const written = tx.class_guests.create.mock.calls[0][0].data.session_date as Date;
    expect(written.toISOString()).toBe(SESSION_DAY_UTC);
  });
});

describe("weekday check keeps local calendar arithmetic (S2)", () => {
  it("accepts the session whose weekday matches the scheduled class", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, SESSION_DAY, isoDayOfWeek(SESSION_DAY));
    tx.class_series_students.findMany.mockResolvedValue([
      { student_id: STUDENT_ID },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: SESSION_DAY,
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(true);
  });

  it("rejects a session dated on another weekday without writing", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, SESSION_DAY, isoDayOfWeek("2026-10-27"));

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: SESSION_DAY,
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.INVALID_SESSION);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });
});

describe("calendar-day guards keep their boundaries (S3)", () => {
  function setupRecurring(sessionDay: string) {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDay);
    tx.class_series_students.findMany.mockResolvedValue([
      { student_id: STUDENT_ID },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });
    return tx;
  }

  it("accepts a session dated today", async () => {
    const tx = setupRecurring(dayAt(0));

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: dayAt(0),
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(dayAt(0)).toBe(SESSION_DAY);
    expect(result.success).toBe(true);
    expect(tx.attendance.create).toHaveBeenCalled();
  });

  it("rejects tomorrow as a future session", async () => {
    const tx = setupRecurring(dayAt(-1));

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: dayAt(-1),
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.FUTURE_SESSION);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it(`accepts a session exactly ${CAPTURE_WINDOW_DAYS} days old`, async () => {
    const tx = setupRecurring(dayAt(CAPTURE_WINDOW_DAYS));

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: dayAt(CAPTURE_WINDOW_DAYS),
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(CAPTURE_WINDOW_DAYS).toBe(30);
    expect(result.success).toBe(true);
    expect(tx.attendance.create).toHaveBeenCalled();
  });

  it(`rejects a session ${CAPTURE_WINDOW_DAYS + 1} days old`, async () => {
    const tx = setupRecurring(dayAt(CAPTURE_WINDOW_DAYS + 1));

    const result = await takeAttendance({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: dayAt(CAPTURE_WINDOW_DAYS + 1),
      records: [{ student_id: STUDENT_ID, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.CAPTURE_WINDOW_EXCEEDED);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it("guest creation rejects tomorrow as a future session", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, dayAt(-1));

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: dayAt(-1),
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.FUTURE_SESSION);
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it(`guest removal accepts a guest of a session exactly ${CAPTURE_WINDOW_DAYS} days old`, async () => {
    const tx = makeMockTx();
    setupAuth(tx, ["teacher"]);
    tx.class_guests.findUnique.mockResolvedValue({
      id: GUEST_ID,
      branch_id: BRANCH_A,
      created_by: USER_ID,
      session_date: new Date(
        new Date(NOW.getTime() - CAPTURE_WINDOW_DAYS * 86400000).toISOString().slice(0, 10) +
          "T00:00:00.000Z"
      ),
    });

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.delete).toHaveBeenCalled();
  });

  it(`guest removal rejects a guest of a session ${CAPTURE_WINDOW_DAYS + 1} days old`, async () => {
    const tx = makeMockTx();
    setupAuth(tx, ["teacher"]);
    tx.class_guests.findUnique.mockResolvedValue({
      id: GUEST_ID,
      branch_id: BRANCH_A,
      created_by: USER_ID,
      session_date: new Date(
        new Date(NOW.getTime() - (CAPTURE_WINDOW_DAYS + 1) * 86400000)
          .toISOString()
          .slice(0, 10) + "T00:00:00.000Z"
      ),
    });

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.REMOVE_WINDOW_EXCEEDED);
    expect(tx.class_guests.delete).not.toHaveBeenCalled();
  });
});
