/**
 * T6 — Attendance reads the assigned roster; per-class students join a
 * session with inline class payment.
 *
 * Covers:
 * - getAttendanceForSession composition and ordering
 *   (roster → per_class → history, each by surname, first_name)
 * - takeAttendance eligibility: roster + per-class students already in the
 *   occurrence; non-roster monthly students rejected
 * - listPerClassCandidates: active per-class students of the discipline not
 *   yet in the occurrence, search, class price
 * - addPerClassStudentToSession: happy path with/without payment, missing
 *   price (no writes), duplicate payment mapping, monthly student rejected,
 *   teacher of another session rejected
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
  addPerClassStudentToSession,
  getAttendanceForSession,
  listPerClassCandidates,
  takeAttendance,
} from "./actions";
import {
  ATTENDANCE_MESSAGES,
  COMMON_MESSAGES,
  PAYMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import type {
  AddPerClassStudentToSessionInput,
  AttendanceForSessionInput,
  ListPerClassCandidatesInput,
  TakeAttendanceInput,
} from "./schema";

const BRANCH_A = "aaaaaaaa-1111-2222-8333-444444444444";
const CLASS_ID = "cccccccc-1111-2222-8333-444444444444";
const ONE_TIME_ID = "8e8e8e8e-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-1111-2222-8333-444444444444";
const DISCIPLINE_ID = "dddddddd-1111-2222-8333-444444444444";
const USER_ID = "eeeeeeee-1111-2222-8333-444444444444";
const OTHER_TEACHER_ID = "eeeeeeee-1111-2222-8333-444444444445";

const S_ROSTER_1 = "11111111-2222-3333-8444-555555555551";
const S_ROSTER_2 = "11111111-2222-3333-8444-555555555552";
const S_PER_CLASS = "11111111-2222-3333-8444-555555555553";
const S_PER_CLASS_CANDIDATE = "11111111-2222-3333-8444-555555555554";
const S_HISTORY = "11111111-2222-3333-8444-555555555555";

const SD_ROSTER_1 = "22222222-3333-4444-8555-666666666661";
const SD_ROSTER_2 = "22222222-3333-4444-8555-666666666662";
const SD_PER_CLASS = "22222222-3333-4444-8555-666666666663";
const SD_PER_CLASS_CANDIDATE = "22222222-3333-4444-8555-666666666664";
const SD_HISTORY = "22222222-3333-4444-8555-666666666665";

const ATTENDANCE_ID = "33333333-4444-5555-8666-777777777771";
const PAYMENT_ID = "44444444-5555-6666-8777-888888888881";

/** Yesterday as YYYY-MM-DD (safe: a session in the past, capture window OK). */
function recentSessionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
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

function baseSessionInput() {
  const sessionDate = recentSessionDate();
  return {
    sessionDate,
    scheduled: {
      branch_id: BRANCH_A,
      scheduled_class_id: CLASS_ID,
      session_date: sessionDate,
    },
    oneTime: {
      branch_id: BRANCH_A,
      one_time_class_id: ONE_TIME_ID,
    },
  };
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
    class_series: {
      findUnique: vi.fn(),
    },
    class_series_students: {
      findMany: vi.fn(),
    },
    one_time_class_students: {
      findMany: vi.fn(),
    },
    class_sessions: {
      findUnique: vi.fn(),
    },
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
    },
    disciplines: {
      findUnique: vi.fn(),
    },
  };
}

type MockTx = ReturnType<typeof makeMockTx>;

interface AuthOverrides {
  roles?: string[];
  assignments?: Array<{ role: string; branchId: string }>;
}

function setupAuth(
  tx: MockTx,
  overrides: AuthOverrides = {}
) {
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
    series_id: SERIES_ID,
  });
  tx.$queryRaw.mockResolvedValue([{ teacher_id: USER_ID }]);
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

/** Authorize a one-time-class session with its fixed teacher. */
function authorizeOneTime(tx: MockTx) {
  tx.one_time_classes.findUnique.mockResolvedValue({
    branch_id: BRANCH_A,
    discipline_id: DISCIPLINE_ID,
    class_date: new Date(),
    teacher_id: USER_ID,
  });
  tx.class_sessions.findUnique.mockResolvedValue(null);
}

describe("getAttendanceForSession — roster ∪ per-class ∪ history composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns roster entries first, then per-class, then history, each by surname", async () => {
    const { sessionDate, scheduled } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);

    tx.class_series_students.findMany.mockResolvedValue([
      {
        student_id: S_ROSTER_1,
        students: { first_name: "Ana", surname: "Zapata" },
      },
      {
        student_id: S_ROSTER_2,
        students: { first_name: "Bruno", surname: "Alvarez" },
      },
    ]);
    tx.attendance.findMany.mockResolvedValue([
      { student_id: S_ROSTER_1, attended: true, observation: null },
      { student_id: S_PER_CLASS, attended: true, observation: "puntual" },
      { student_id: S_HISTORY, attended: false, observation: "previo" },
    ]);
    tx.student_disciplines.findMany.mockResolvedValue([
      {
        id: SD_ROSTER_1,
        student_id: S_ROSTER_1,
        billing_mode: "monthly",
        is_active: true,
      },
      {
        id: SD_ROSTER_2,
        student_id: S_ROSTER_2,
        billing_mode: "monthly",
        is_active: true,
      },
      {
        id: SD_PER_CLASS,
        student_id: S_PER_CLASS,
        billing_mode: "per_class",
        is_active: true,
      },
      {
        id: SD_HISTORY,
        student_id: S_HISTORY,
        billing_mode: "monthly",
        is_active: false,
      },
    ]);
    tx.class_payments.findMany.mockResolvedValue([
      { student_discipline_id: SD_PER_CLASS },
    ]);
    tx.students.findMany.mockResolvedValue([
      { id: S_PER_CLASS, first_name: "Beto", surname: "Alvarez" },
      { id: S_HISTORY, first_name: "Caro", surname: "Diaz" },
    ]);

    const result = await getAttendanceForSession(
      scheduled as AttendanceForSessionInput
    );

    expect(result.success).toBe(true);
    const rows = result.data!.students;
    expect(rows.map((r) => `${r.source}:${r.surname}`)).toEqual([
      "roster:Alvarez",
      "roster:Zapata",
      "per_class:Alvarez",
      "history:Diaz",
    ]);

    const perClass = rows[2];
    expect(perClass).toMatchObject({
      student_id: S_PER_CLASS,
      student_discipline_id: SD_PER_CLASS,
      attended: true,
      observation: "puntual",
      source: "per_class",
      billing_mode: "per_class",
      class_payment_registered: true,
    });
    const history = rows[3];
    expect(history).toMatchObject({
      student_id: S_HISTORY,
      source: "history",
      billing_mode: "monthly",
      class_payment_registered: false,
    });
    const roster = rows[0];
    expect(roster).toMatchObject({
      student_id: S_ROSTER_2,
      source: "roster",
      billing_mode: "monthly",
      attended: null,
      class_payment_registered: false,
    });
  });

  it("builds the roster from one_time_class_students for one-time classes", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx);

    tx.one_time_class_students.findMany.mockResolvedValue([
      {
        student_id: S_ROSTER_1,
        students: { first_name: "Ana", surname: "Zapata" },
      },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.student_disciplines.findMany.mockResolvedValue([
      {
        id: SD_ROSTER_1,
        student_id: S_ROSTER_1,
        billing_mode: "monthly",
        is_active: true,
      },
    ]);
    tx.class_payments.findMany.mockResolvedValue([]);

    const result = await getAttendanceForSession(
      oneTime as AttendanceForSessionInput
    );

    expect(result.success).toBe(true);
    expect(result.data!.students).toHaveLength(1);
    expect(result.data!.students[0]).toMatchObject({
      student_id: S_ROSTER_1,
      source: "roster",
      attended: null,
    });
    expect(tx.one_time_class_students.findMany).toHaveBeenCalled();
    expect(tx.class_series_students.findMany).not.toHaveBeenCalled();
  });
});

describe("takeAttendance — roster + per-class eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a monthly student who is not on the roster (INELIGIBLE_STUDENT)", async () => {
    const { sessionDate, scheduled } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);

    tx.class_series_students.findMany.mockResolvedValue([]);
    tx.attendance.findMany.mockResolvedValue([]);

    const result = await takeAttendance({
      ...scheduled,
      records: [{ student_id: S_HISTORY, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.INELIGIBLE_STUDENT);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it("accepts a per-class student already added to the occurrence", async () => {
    const { sessionDate, scheduled } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);

    tx.class_series_students.findMany.mockResolvedValue([]);
    tx.attendance.findMany.mockResolvedValue([
      { student_id: S_PER_CLASS, attended: true, observation: null },
    ]);
    tx.student_disciplines.findMany.mockResolvedValue([
      {
        id: SD_PER_CLASS,
        student_id: S_PER_CLASS,
        billing_mode: "per_class",
        is_active: true,
      },
    ]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await takeAttendance({
      ...scheduled,
      records: [{ student_id: S_PER_CLASS, attended: false }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(true);
    expect(tx.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          student_id: S_PER_CLASS,
          attended: false,
        }),
      })
    );
  });

  it("still accepts roster students for the scheduled session", async () => {
    const { sessionDate, scheduled } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeScheduled(tx, sessionDate);

    tx.class_series_students.findMany.mockResolvedValue([
      { student_id: S_ROSTER_1 },
    ]);
    tx.attendance.findMany.mockResolvedValue([]);
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });

    const result = await takeAttendance({
      ...scheduled,
      records: [{ student_id: S_ROSTER_1, attended: true }],
    } as TakeAttendanceInput);

    expect(result.success).toBe(true);
    expect(tx.attendance.create).toHaveBeenCalled();
  });
});

describe("listPerClassCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active per-class students of the discipline not yet in the occurrence, with the class price", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx);

    tx.attendance.findMany.mockResolvedValue([
      { student_id: S_PER_CLASS, attended: true, observation: null },
    ]);
    tx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_PER_CLASS },
      { student_id: S_PER_CLASS_CANDIDATE },
    ]);
    tx.students.findMany.mockResolvedValue([
      {
        id: S_PER_CLASS_CANDIDATE,
        first_name: "Dana",
        surname: "Lopez",
        national_id: "1710000001",
        student_discipline_id: SD_PER_CLASS_CANDIDATE,
      },
    ]);
    tx.disciplines.findUnique.mockResolvedValue({ class_price: 5 });

    const result = await listPerClassCandidates(
      oneTime as ListPerClassCandidatesInput
    );

    expect(result.success).toBe(true);
    expect(result.data!.class_price).toBe(5);
    expect(result.data!.students).toHaveLength(1);
    expect(result.data!.students[0].student_id).toBe(S_PER_CLASS_CANDIDATE);
    // Already-added per-class student is excluded from the candidate query
    const studentsWhere = tx.students.findMany.mock.calls[0][0].where;
    expect(studentsWhere.id.in).toEqual([S_PER_CLASS_CANDIDATE]);
  });

  it("applies the case-insensitive search on names and national_id", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx);
    authorizeOneTime(tx);

    tx.attendance.findMany.mockResolvedValue([]);
    tx.student_disciplines.findMany.mockResolvedValue([
      { student_id: S_PER_CLASS_CANDIDATE },
    ]);
    tx.students.findMany.mockResolvedValue([]);
    tx.disciplines.findUnique.mockResolvedValue({ class_price: null });

    const result = await listPerClassCandidates({
      ...oneTime,
      search: "ana",
    } as ListPerClassCandidatesInput);

    expect(result.success).toBe(true);
    expect(result.data!.class_price).toBeNull();
    const studentsWhere = tx.students.findMany.mock.calls[0][0].where;
    expect(studentsWhere.OR).toBeDefined();
  });

  it("rejects a caller who is neither the session teacher nor a branch admin", async () => {
    const { sessionDate, scheduled } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    authorizeScheduled(tx, sessionDate);
    tx.$queryRaw.mockResolvedValue([{ teacher_id: OTHER_TEACHER_ID }]);

    const result = await listPerClassCandidates(
      scheduled as ListPerClassCandidatesInput
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
    expect(tx.attendance.findMany).not.toHaveBeenCalled();
  });
});

describe("addPerClassStudentToSession", () => {
  function setupHappyPath(tx: MockTx) {
    authorizeOneTime(tx);
    tx.students.findUnique.mockResolvedValue({
      id: S_PER_CLASS,
      branch_id: BRANCH_A,
      is_active: true,
    });
    tx.student_disciplines.findFirst.mockResolvedValue({
      id: SD_PER_CLASS,
      billing_mode: "per_class",
      disciplines: { class_price: 5 },
    });
    tx.attendance.findFirst.mockResolvedValue(null);
    tx.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID });
    tx.student_disciplines.findUnique.mockResolvedValue({
      id: SD_PER_CLASS,
      disciplines: { class_price: 5 },
      students: { branch_id: BRANCH_A },
    });
    tx.$queryRaw.mockResolvedValue([
      { payment_due_day: 5, payment_edit_window_days: 3 },
    ]);
    tx.class_payments.create.mockResolvedValue({
      id: PAYMENT_ID,
      amount: 5,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the student, creates the attendance, and registers the class payment by default", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupHappyPath(tx);
    setupAuth(tx);

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_PER_CLASS,
      observation: "llegó tarde",
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      attendance_id: ATTENDANCE_ID,
      class_payment_id: PAYMENT_ID,
      amount: 5,
    });
    expect(tx.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          student_id: S_PER_CLASS,
          attended: true,
          observation: "llegó tarde",
          one_time_class_id: ONE_TIME_ID,
        }),
      })
    );
    expect(tx.class_payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          student_discipline_id: SD_PER_CLASS,
          amount: 5,
          one_time_class_id: ONE_TIME_ID,
        }),
      })
    );
  });

  it("skips the payment when register_payment is false", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupHappyPath(tx);
    setupAuth(tx);

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_PER_CLASS,
      register_payment: false,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      attendance_id: ATTENDANCE_ID,
      class_payment_id: null,
      amount: null,
    });
    expect(tx.class_payments.create).not.toHaveBeenCalled();
  });

  it("fails with CLASS_PRICE_NOT_SET and writes nothing when the discipline has no class price", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    authorizeOneTime(tx);
    tx.students.findUnique.mockResolvedValue({
      id: S_PER_CLASS,
      branch_id: BRANCH_A,
      is_active: true,
    });
    tx.student_disciplines.findFirst.mockResolvedValue({
      id: SD_PER_CLASS,
      billing_mode: "per_class",
      disciplines: { class_price: null },
    });

    setupAuth(tx);

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_PER_CLASS,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(PAYMENT_MESSAGES.CLASS_PRICE_NOT_SET);
    expect(tx.attendance.create).not.toHaveBeenCalled();
    expect(tx.class_payments.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate occurrence payment to ALREADY_PAID", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupHappyPath(tx);
    tx.class_payments.create.mockRejectedValue(
      new Error(
        "Unique constraint failed on the fields: (`class_payments_one_time_occurrence_uq`)"
      )
    );
    setupAuth(tx);

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_PER_CLASS,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(PAYMENT_MESSAGES.ALREADY_PAID);
  });

  it("rejects a monthly-billed student", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    authorizeOneTime(tx);
    tx.students.findUnique.mockResolvedValue({
      id: S_HISTORY,
      branch_id: BRANCH_A,
      is_active: true,
    });
    tx.student_disciplines.findFirst.mockResolvedValue(null);
    setupAuth(tx);

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_HISTORY,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ATTENDANCE_MESSAGES.STUDENT_NOT_PER_CLASS);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it("rejects the teacher of another session", async () => {
    const { oneTime } = baseSessionInput();
    const tx = makeMockTx();
    setupAuth(tx, {
      roles: ["teacher"],
      assignments: [{ role: "teacher", branchId: BRANCH_A }],
    });
    tx.one_time_classes.findUnique.mockResolvedValue({
      branch_id: BRANCH_A,
      discipline_id: DISCIPLINE_ID,
      class_date: new Date(),
      teacher_id: OTHER_TEACHER_ID,
    });

    const result = await addPerClassStudentToSession({
      ...oneTime,
      student_id: S_PER_CLASS,
    } as AddPerClassStudentToSessionInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });
});
