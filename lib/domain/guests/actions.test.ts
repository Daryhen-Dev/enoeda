/**
 * T7 — Guests (trial-class attendees).
 *
 * Covers:
 * - addGuestToSession: same session authorization and guards as
 *   addPerClassStudentToSession (teacher of the session or branch admin;
 *   suspension, future date and capture window rules)
 * - listSessionGuests: guests of the occurrence with converted_student_id
 * - removeGuestFromSession: admin, or the teacher who created it within
 *   the capture window
 * - getGuestForConversion: prefill data + class discipline
 * - linkGuestToStudent: idempotency and cross-branch rejection
 * - getAttendanceForSession also returns guests (separate `guests` array)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  addGuestToSession,
  getGuestForConversion,
  linkGuestToStudent,
  listSessionGuests,
  removeGuestFromSession,
} from "./actions";
import { getAttendanceForSession } from "@/lib/domain/attendance/actions";
import {
  ATTENDANCE_MESSAGES,
  COMMON_MESSAGES,
  GUEST_MESSAGES,
} from "@/lib/localization/es-ec";
import { BRANCH_ASSERTION_MESSAGES } from "@/lib/auth/branch-assertion";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-8333-444444444444";
const CLASS_ID = "cccccccc-1111-2222-8333-444444444444";
const ONE_TIME_ID = "8e8e8e8e-1111-2222-8333-444444444444";
const GUEST_ID = "77777777-1111-2222-8333-444444444441";
const STUDENT_ID = "55555555-1111-2222-8333-444444444441";
const OTHER_STUDENT_ID = "55555555-1111-2222-8333-444444444442";
const DISCIPLINE_ID = "dddddddd-1111-2222-8333-444444444444";
const USER_ID = "eeeeeeee-1111-2222-8333-444444444444";
const OTHER_TEACHER_ID = "eeeeeeee-1111-2222-8333-444444444445";

/** Yesterday as YYYY-MM-DD (capture window OK). */
function recentSessionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Tomorrow as YYYY-MM-DD (future guard). */
function futureSessionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 31 days ago as YYYY-MM-DD (capture window exceeded). */
function staleSessionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 31);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS getDay() → ISO day_of_week (0=Mon..6=Sun), as used by the actions. */
function isoDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

function makeMockTx() {
  return {
    $queryRaw: vi.fn(),
    scheduled_classes: {
      findUnique: vi.fn(),
    },
    one_time_classes: {
      findUnique: vi.fn(),
    },
    class_sessions: {
      findUnique: vi.fn(),
    },
    class_guests: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    branches: {
      findUnique: vi.fn(),
    },
    students: {
      findUnique: vi.fn(),
    },
    class_series_students: {
      findMany: vi.fn(),
    },
    one_time_class_students: {
      findMany: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
    },
    student_disciplines: {
      findMany: vi.fn(),
    },
    class_payments: {
      findMany: vi.fn(),
    },
  };
}

type MockTx = ReturnType<typeof makeMockTx>;

interface AuthOverrides {
  roles?: string[];
  assignments?: Array<{ role: string; branchId: string }>;
}

function setupAuth(tx: MockTx, overrides: AuthOverrides = {}) {
  mockWithAuth.mockImplementation(
    async (
      fn: (tx: MockTx, ctx: unknown) => Promise<unknown>,
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

/** Authorize a scheduled-class session: teacher match + weekday match. */
function authorizeScheduled(tx: MockTx, sessionDate: string) {
  tx.scheduled_classes.findUnique.mockResolvedValue({
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_ID,
    day_of_week: isoDayOfWeek(sessionDate),
    series_id: null,
  });
  tx.$queryRaw.mockResolvedValue([{ teacher_id: USER_ID }]);
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

/** Authorize a one-time-class session with its fixed teacher. */
function authorizeOneTime(tx: MockTx, classDate: Date) {
  tx.one_time_classes.findUnique.mockResolvedValue({
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_ID,
    class_date: classDate,
    teacher_id: USER_ID,
  });
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

function guestRow(overrides: Record<string, unknown> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    id: GUEST_ID,
    branch_id: BRANCH_A,
    first_name: "María",
    surname: "Pérez",
    phone: "0991112222",
    observation: null,
    converted_student_id: null,
    created_by: USER_ID,
    session_date: yesterday,
    ...overrides,
  };
}

describe("addGuestToSession — guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a guest for a scheduled session and returns guest_id", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);
    tx.class_guests.create.mockResolvedValue({ id: GUEST_ID });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
      phone: "0991112222",
      observation: "Vino con Ana",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ guest_id: GUEST_ID });
    expect(tx.class_guests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branch_id: BRANCH_A,
          scheduled_class_id: CLASS_ID,
          one_time_class_id: null,
          first_name: "María",
          surname: "Pérez",
          phone: "0991112222",
          observation: "Vino con Ana",
          created_by: USER_ID,
        }),
      })
    );
    const [y, m, d] = sessionDate.split("-").map(Number);
    const sessionDateArg = tx.class_guests.create.mock.calls[0][0].data
      .session_date as Date;
    expect(sessionDateArg.getFullYear()).toBe(y);
    expect(sessionDateArg.getMonth()).toBe(m - 1);
    expect(sessionDateArg.getDate()).toBe(d);
  });

  it("uses the class date as session_date for one-time classes", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    authorizeOneTime(tx, yesterday);
    tx.class_guests.create.mockResolvedValue({ id: GUEST_ID });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      first_name: "Luis",
      surname: "Gómez",
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduled_class_id: null,
          one_time_class_id: ONE_TIME_ID,
        }),
      })
    );
    const sessionDateArg = tx.class_guests.create.mock.calls[0][0].data
      .session_date as Date;
    expect(sessionDateArg.getDate()).toBe(yesterday.getDate());
  });

  it("rejects a teacher of another session", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    tx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_ID,
      day_of_week: isoDayOfWeek(sessionDate),
      series_id: null,
    });
    tx.$queryRaw.mockResolvedValue([{ teacher_id: OTHER_TEACHER_ID }]);

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it("rejects a suspended session", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);
    tx.class_sessions.findUnique.mockResolvedValue({ status: "suspended" });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.SESSION_SUSPENDED);
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it("rejects a future session", async () => {
    const sessionDate = futureSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    tx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_ID,
      day_of_week: isoDayOfWeek(sessionDate),
      series_id: null,
    });
    tx.$queryRaw.mockResolvedValue([{ teacher_id: USER_ID }]);
    tx.class_sessions.findUnique.mockResolvedValue(null);

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.FUTURE_SESSION);
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it("rejects when the caller has no assignment for the branch (branch mismatch)", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx, {
      assignments: [{ role: "admin", branchId: BRANCH_B }],
    });

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(BRANCH_ASSERTION_MESSAGES.CALLER_NOT_ASSIGNED);
    expect(mockWithAuth).toHaveBeenCalled();
    expect(tx.scheduled_classes.findUnique).not.toHaveBeenCalled();
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it("rejects a session beyond the capture window", async () => {
    const sessionDate = staleSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    tx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_ID,
      day_of_week: isoDayOfWeek(sessionDate),
      series_id: null,
    });
    tx.$queryRaw.mockResolvedValue([{ teacher_id: USER_ID }]);
    tx.class_sessions.findUnique.mockResolvedValue(null);

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
      first_name: "María",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.CAPTURE_WINDOW_EXCEEDED);
    expect(tx.class_guests.create).not.toHaveBeenCalled();
  });

  it("rejects empty first_name via schema validation", async () => {
    const tx = makeMockTx();
    setupAuth(tx);

    const result = await addGuestToSession({
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
      first_name: "   ",
      surname: "Pérez",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.FIRST_NAME_REQUIRED);
    expect(mockWithAuth).not.toHaveBeenCalled();
  });
});

describe("listSessionGuests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the guests of the occurrence with converted_student_id", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);
    tx.class_guests.findMany.mockResolvedValue([
      guestRow(),
      guestRow({
        id: "77777777-1111-2222-8333-444444444442",
        first_name: "Luis",
        surname: "Gómez",
        phone: null,
        converted_student_id: STUDENT_ID,
      }),
    ]);

    const result = await listSessionGuests({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      {
        guest_id: GUEST_ID,
        first_name: "María",
        surname: "Pérez",
        phone: "0991112222",
        observation: null,
        converted_student_id: null,
        created_by: USER_ID,
      },
      {
        guest_id: "77777777-1111-2222-8333-444444444442",
        first_name: "Luis",
        surname: "Gómez",
        phone: null,
        observation: null,
        converted_student_id: STUDENT_ID,
        created_by: USER_ID,
      },
    ]);
  });

  it("rejects a teacher of another session", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    tx.scheduled_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_ID,
      day_of_week: isoDayOfWeek(sessionDate),
      series_id: null,
    });
    tx.$queryRaw.mockResolvedValue([{ teacher_id: OTHER_TEACHER_ID }]);

    const result = await listSessionGuests({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
  });
});

describe("removeGuestFromSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a branch admin remove any guest", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ created_by: OTHER_TEACHER_ID })
    );

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.delete).toHaveBeenCalledWith({
      where: { id: GUEST_ID },
    });
  });

  it("lets the teacher who created the guest remove it within the capture window", async () => {
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ created_by: USER_ID, session_date: yesterday })
    );

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.delete).toHaveBeenCalled();
  });

  it("rejects a teacher who did not create the guest", async () => {
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ created_by: OTHER_TEACHER_ID, session_date: yesterday })
    );

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
    expect(tx.class_guests.delete).not.toHaveBeenCalled();
  });

  it("rejects the creator beyond the capture window", async () => {
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    const stale = new Date();
    stale.setDate(stale.getDate() - 40);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ created_by: USER_ID, session_date: stale })
    );

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.REMOVE_WINDOW_EXCEEDED);
    expect(tx.class_guests.delete).not.toHaveBeenCalled();
  });

  it("rejects a guest from another branch without deleting", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ branch_id: BRANCH_B })
    );

    const result = await removeGuestFromSession({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.NOT_FOUND);
    expect(tx.class_guests.delete).not.toHaveBeenCalled();
  });
});

describe("getGuestForConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prefill data and the class discipline for a scheduled class", async () => {
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({
        scheduled_class_id: CLASS_ID,
        one_time_class_id: null,
      })
    );
    tx.scheduled_classes.findUnique.mockResolvedValue({
      discipline_id: DISCIPLINE_ID,
      disciplines: { name: "Taekwondo" },
    });
    tx.branches.findUnique.mockResolvedValue({ name: "Sucursal Norte" });

    const result = await getGuestForConversion({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      first_name: "María",
      surname: "Pérez",
      phone: "0991112222",
      discipline_id: DISCIPLINE_ID,
      discipline_name: "Taekwondo",
      branch_name: "Sucursal Norte",
    });
  });

  it("returns the one-time class discipline", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({
        scheduled_class_id: null,
        one_time_class_id: ONE_TIME_ID,
      })
    );
    tx.one_time_classes.findUnique.mockResolvedValue({
      discipline_id: DISCIPLINE_ID,
      disciplines: { name: "Judo" },
    });
    tx.branches.findUnique.mockResolvedValue({ name: "Sucursal Norte" });

    const result = await getGuestForConversion({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      discipline_id: DISCIPLINE_ID,
      discipline_name: "Judo",
      branch_name: "Sucursal Norte",
    });
  });

  it("rejects a teacher without an assignment for the branch", async () => {
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_B }],
    });

    const result = await getGuestForConversion({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(BRANCH_ASSERTION_MESSAGES.CALLER_NOT_ASSIGNED);
    expect(tx.class_guests.findUnique).not.toHaveBeenCalled();
  });
});

describe("linkGuestToStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links an unconverted guest to a student of the same branch", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ converted_student_id: null })
    );
    tx.students.findUnique.mockResolvedValue({ branch_id: BRANCH_A });

    const result = await linkGuestToStudent({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
      student_id: STUDENT_ID,
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { converted_student_id: STUDENT_ID },
      })
    );
  });

  it("is idempotent when the guest is already linked to the same student", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ converted_student_id: STUDENT_ID })
    );

    const result = await linkGuestToStudent({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
      student_id: STUDENT_ID,
    });

    expect(result.success).toBe(true);
    expect(tx.class_guests.update).not.toHaveBeenCalled();
  });

  it("rejects linking to a different student when already converted", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ converted_student_id: STUDENT_ID })
    );
    tx.students.findUnique.mockResolvedValue({ branch_id: BRANCH_A });

    const result = await linkGuestToStudent({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
      student_id: OTHER_STUDENT_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.ALREADY_LINKED);
    expect(tx.class_guests.update).not.toHaveBeenCalled();
  });

  it("rejects a student from another branch", async () => {
    const tx = makeMockTx();
    setupAuth(tx);
    tx.class_guests.findUnique.mockResolvedValue(
      guestRow({ converted_student_id: null })
    );
    tx.students.findUnique.mockResolvedValue({ branch_id: BRANCH_B });

    const result = await linkGuestToStudent({
      branch_id: BRANCH_A,
      guest_id: GUEST_ID,
      student_id: STUDENT_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(GUEST_MESSAGES.STUDENT_BRANCH_MISMATCH);
    expect(tx.class_guests.update).not.toHaveBeenCalled();
  });
});

describe("getAttendanceForSession — guests composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the student entries and the guests in a separate array", async () => {
    const sessionDate = recentSessionDate();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);
    tx.class_series_students.findMany.mockResolvedValue([]);
    tx.one_time_class_students.findMany.mockResolvedValue([]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.student_disciplines.findMany.mockResolvedValue([]);
    tx.class_guests.findMany.mockResolvedValue([
      guestRow(),
      guestRow({
        id: "77777777-1111-2222-8333-444444444442",
        first_name: "Luis",
        surname: "Gómez",
        phone: null,
        converted_student_id: STUDENT_ID,
      }),
    ]);

    const result = await getAttendanceForSession({
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data!.students)).toBe(true);
    expect(result.data!.students).toHaveLength(0);
    expect(result.data!.guests).toEqual([
      {
        guest_id: GUEST_ID,
        first_name: "María",
        surname: "Pérez",
        phone: "0991112222",
        observation: null,
        converted_student_id: null,
        created_by: USER_ID,
      },
      {
        guest_id: "77777777-1111-2222-8333-444444444442",
        first_name: "Luis",
        surname: "Gómez",
        phone: null,
        observation: null,
        converted_student_id: STUDENT_ID,
        created_by: USER_ID,
      },
    ]);
  });
});
