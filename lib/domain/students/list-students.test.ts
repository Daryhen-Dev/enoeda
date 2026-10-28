/**
 * listStudents — directory page contract.
 *
 * The directory shows the current belt of every active discipline next to the
 * student name, so one page of students must resolve all its belts without a
 * per-student query: a single grouped lookup over the page's student ids, and
 * the level of the latest promotion of each student+discipline wins.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) =>
    mockWithAuthenticatedUser(...args),
}));

import { listStudents } from "./actions";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const ANA_ID = "cccccccc-1111-4222-8333-444444444441";
const BRUNO_ID = "cccccccc-2222-4222-8333-444444444442";
const KARATE_ENROLLMENT_ID = "eeeeeeee-1111-4222-8333-444444444441";
const AJEDREZ_ENROLLMENT_ID = "eeeeeeee-2222-4222-8333-444444444442";
const KARATE_DISCIPLINE_ID = "ffffffff-1111-4222-8333-444444444441";
const AJEDREZ_DISCIPLINE_ID = "ffffffff-2222-4222-8333-444444444442";
const BLACK_BELT_COLOR = "#7c3aed";

const CTX = {
  userId: "user-1",
  roles: ["admin"],
  assignments: [{ branchId: BRANCH_ID, role: "admin" }],
};

interface StudentRowDiscipline {
  id: string;
  discipline_id: string;
  next_due_date: Date | null;
  billing_mode: "monthly" | "per_class";
  disciplines: { name: string };
}

function makeStudentRow(overrides: {
  id?: string;
  first_name?: string;
  surname?: string;
  activation_status?: "active" | "pending";
  student_disciplines?: StudentRowDiscipline[];
}) {
  return {
    id: overrides.id ?? ANA_ID,
    branch_id: BRANCH_ID,
    first_name: overrides.first_name ?? "Ana",
    surname: overrides.surname ?? "Pérez",
    national_id: null,
    email: null,
    date_of_birth: null,
    activation_status: overrides.activation_status ?? "active",
    student_disciplines: overrides.student_disciplines ?? [
      {
        id: KARATE_ENROLLMENT_ID,
        discipline_id: KARATE_DISCIPLINE_ID,
        next_due_date: null,
        billing_mode: "monthly" as const,
        disciplines: { name: "Karate" },
      },
    ],
  };
}

function makeProgressRow(overrides: {
  student_id?: string;
  discipline_id?: string;
  name?: string;
  color?: string | null;
}) {
  return {
    student_id: overrides.student_id ?? ANA_ID,
    discipline_id: overrides.discipline_id ?? KARATE_DISCIPLINE_ID,
    discipline_levels: {
      name: overrides.name ?? "Cinturón negro",
      color: overrides.color === undefined ? BLACK_BELT_COLOR : overrides.color,
    },
  };
}

function mockTransaction(options: {
  students: unknown[];
  progress?: unknown[];
}) {
  const studentsFindMany = vi.fn(async () => options.students);
  const progressFindMany = vi.fn(async () => options.progress ?? []);

  mockWithAuthenticatedUser.mockImplementation(
    async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => ({
      success: true,
      data: await fn(
        {
          students: { findMany: studentsFindMany },
          student_progress: { findMany: progressFindMany },
        },
        CTX
      ),
    })
  );

  return { studentsFindMany, progressFindMany };
}

describe("listStudents — current belt per active discipline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches the belt of each active discipline from one grouped query", async () => {
    const { progressFindMany } = mockTransaction({
      students: [
        makeStudentRow({
          student_disciplines: [
            {
              id: KARATE_ENROLLMENT_ID,
              discipline_id: KARATE_DISCIPLINE_ID,
              next_due_date: null,
              billing_mode: "monthly",
              disciplines: { name: "Karate" },
            },
            {
              id: AJEDREZ_ENROLLMENT_ID,
              discipline_id: AJEDREZ_DISCIPLINE_ID,
              next_due_date: null,
              billing_mode: "per_class",
              disciplines: { name: "Ajedrez" },
            },
          ],
        }),
      ],
      progress: [makeProgressRow({})],
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.success).toBe(true);
    const disciplines = result.data?.items[0].active_disciplines ?? [];

    // Karate has a recorded level; Ajedrez has none.
    expect(disciplines).toEqual([
      expect.objectContaining({
        discipline_name: "Ajedrez",
        level_name: null,
        level_color: null,
      }),
      expect.objectContaining({
        discipline_name: "Karate",
        level_name: "Cinturón negro",
        level_color: BLACK_BELT_COLOR,
      }),
    ]);

    // ONE grouped query for the whole page, not one per student.
    expect(progressFindMany).toHaveBeenCalledTimes(1);
    expect(progressFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { student_id: { in: [ANA_ID] } },
        distinct: ["student_id", "discipline_id"],
        orderBy: [
          { student_id: "asc" },
          { discipline_id: "asc" },
          { promoted_at: "desc" },
          { created_at: "desc" },
        ],
      })
    );
  });

  it("leaves the belt empty when no level was ever recorded", async () => {
    mockTransaction({ students: [makeStudentRow({})], progress: [] });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.data?.items[0].active_disciplines[0]).toEqual(
      expect.objectContaining({ level_name: null, level_color: null })
    );
  });

  it("keeps a level that has no color as a level-only belt", async () => {
    mockTransaction({
      students: [makeStudentRow({})],
      progress: [makeProgressRow({ color: null })],
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.data?.items[0].active_disciplines[0]).toEqual(
      expect.objectContaining({
        level_name: "Cinturón negro",
        level_color: null,
      })
    );
  });

  it("scopes the belt lookup to the students of the page being returned", async () => {
    const { progressFindMany } = mockTransaction({
      students: [
        makeStudentRow({ id: ANA_ID }),
        makeStudentRow({ id: BRUNO_ID, first_name: "Bruno", surname: "Vega" }),
      ],
      progress: [makeProgressRow({})],
    });

    const result = await listStudents({ branch_id: BRANCH_ID, page_size: 1 });

    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.next_cursor).toBe(ANA_ID);
    expect(progressFindMany).toHaveBeenCalledTimes(1);
    expect(progressFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { student_id: { in: [ANA_ID] } } })
    );
  });

  it("skips the belt lookup when the page has no students", async () => {
    const { progressFindMany } = mockTransaction({ students: [] });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result).toEqual({
      success: true,
      data: { items: [], next_cursor: null },
    });
    expect(progressFindMany).not.toHaveBeenCalled();
  });
});

describe("listStudents — existing page behaviour is preserved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the cursor pagination shape of the students query", async () => {
    const { studentsFindMany } = mockTransaction({
      students: [makeStudentRow({}), makeStudentRow({ id: BRUNO_ID })],
    });

    const result = await listStudents({
      branch_id: BRANCH_ID,
      page_size: 1,
      cursor: ANA_ID,
    });

    expect(studentsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        cursor: { id: ANA_ID },
        skip: 1,
      })
    );
    expect(result.data).toEqual({
      items: [expect.objectContaining({ id: ANA_ID })],
      next_cursor: ANA_ID,
    });
  });

  it("keeps returning the activation status of each listed student", async () => {
    mockTransaction({
      students: [makeStudentRow({ activation_status: "pending" })],
    });

    const result = await listStudents({ branch_id: BRANCH_ID });

    expect(result.data?.items[0]).toEqual(
      expect.objectContaining({ activation_status: "pending" })
    );
  });
});
