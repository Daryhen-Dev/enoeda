// @vitest-environment jsdom

/**
 * Student directory table — name cell contract.
 *
 * The name cell tells the same story as the mobile card: one hairline belt
 * swatch per active discipline that has a recorded level (no empty swatches),
 * a "Pendiente de activación" badge only while the record is pending, and the
 * incomplete-data badge. The always-on "Estado"/"Activación" columns are gone.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EcuadorTimeZone } from "@/lib/domain/branches/schema";
import {
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_LIFECYCLE_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-8333-444444444444";
const KARATE_ENROLLMENT_ID = "eeeeeeee-1111-4222-8333-444444444441";
const AJEDREZ_ENROLLMENT_ID = "eeeeeeee-2222-4222-8333-444444444442";
const BLACK_BELT_COLOR = "#7c3aed";
const TIME_ZONE: EcuadorTimeZone = "America/Guayaquil";

vi.mock("@/lib/domain/students", async () => {
  const { getMissingStudentData, hasIncompleteStudentData } = await import(
    "@/lib/domain/students/completeness"
  );

  return {
    getMissingStudentData,
    hasIncompleteStudentData,
    activateStudent: vi.fn(),
    reactivateStudent: vi.fn(),
    STUDENT_STATUS: { ACTIVE: "active", INACTIVE: "inactive" },
    STUDENT_ACTIVATION_STATUS: { PENDING: "pending", ACTIVE: "active" },
  };
});

vi.mock("@/lib/domain/students/actions", () => ({
  deactivateStudent: vi.fn(),
  createStudent: vi.fn(),
  findStudentsWithSameName: vi.fn(),
  getStudentById: vi.fn(),
  updateStudent: vi.fn(),
}));

vi.mock("@/lib/domain/payments/actions", () => ({
  registerMonthlyPayment: vi.fn(),
  registerClassPayment: vi.fn(),
}));

vi.mock("@/lib/domain/disciplines/actions", () => ({
  enrollStudent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { getStudentColumns, StudentNameCell } from "./student-columns";

const BRANCHES = [{ id: BRANCH_ID, name: "Sucursal Norte" }];

function makeDiscipline(overrides: {
  id: string;
  discipline_name: string;
  level_name?: string | null;
  level_color?: string | null;
  billing_mode?: "monthly" | "per_class";
}) {
  return {
    id: overrides.id,
    discipline_name: overrides.discipline_name,
    next_due_date: null,
    billing_mode: overrides.billing_mode ?? ("monthly" as const),
    level_name: overrides.level_name === undefined ? null : overrides.level_name,
    level_color:
      overrides.level_color === undefined ? null : overrides.level_color,
  };
}

function makeStudent(overrides: {
  activation_status?: "active" | "pending";
  national_id?: string | null;
  email?: string | null;
  active_disciplines?: ReturnType<typeof makeDiscipline>[];
}) {
  const disciplines = overrides.active_disciplines ?? [
    makeDiscipline({
      id: KARATE_ENROLLMENT_ID,
      discipline_name: "Karate",
      level_name: "Cinturón negro",
      level_color: BLACK_BELT_COLOR,
    }),
  ];

  return {
    id: STUDENT_ID,
    branch_id: BRANCH_ID,
    first_name: "Ana",
    surname: "Pérez",
    national_id:
      overrides.national_id === undefined ? "1712345678" : overrides.national_id,
    email: overrides.email === undefined ? "ana@example.com" : overrides.email,
    date_of_birth: new Date("2010-05-04T00:00:00.000Z"),
    activation_status: overrides.activation_status ?? "active",
    active_discipline_names: disciplines.map(
      (discipline) => discipline.discipline_name
    ),
    active_disciplines: disciplines,
  };
}

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderNameCell(student: ReturnType<typeof makeStudent>): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StudentNameCell student={student} />);
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Browser-normalized inline color, so #7c3aed and rgb(...) compare equal. */
function normalizedColor(color: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = color;
  return probe.style.backgroundColor;
}

describe("StudentNameCell — belt swatches", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders the level color of the belt next to the name with a hairline border", () => {
    rendered = renderNameCell(makeStudent({}));

    const swatch = rendered.container.querySelector<HTMLElement>(
      '[role="img"]'
    );
    expect(swatch).not.toBeNull();
    const strip = swatch?.querySelector<HTMLElement>(
      '[class*="border-border"]'
    );
    expect(strip).not.toBeNull();
    expect(strip?.getAttribute("style")).toContain("background-color");
    expect(strip?.style.backgroundColor).toBe(
      normalizedColor(BLACK_BELT_COLOR)
    );
  });

  it("names the level and its discipline for assistive tech", () => {
    rendered = renderNameCell(makeStudent({}));

    const swatch = rendered.container.querySelector('[role="img"]');
    const label = swatch?.getAttribute("aria-label") ?? "";
    expect(label).toContain("Cinturón negro");
    expect(label).toContain("Karate");
  });

  it("renders one swatch per active discipline that has a level", () => {
    rendered = renderNameCell(
      makeStudent({
        active_disciplines: [
          makeDiscipline({
            id: KARATE_ENROLLMENT_ID,
            discipline_name: "Karate",
            level_name: "Cinturón negro",
            level_color: BLACK_BELT_COLOR,
          }),
          makeDiscipline({
            id: AJEDREZ_ENROLLMENT_ID,
            discipline_name: "Ajedrez",
            level_name: null,
            level_color: null,
          }),
        ],
      })
    );

    const swatches = [...rendered.container.querySelectorAll('[role="img"]')];
    expect(swatches).toHaveLength(1);
    expect(swatches[0].getAttribute("aria-label")).toContain("Cinturón negro");
  });

  it("renders no swatch at all when no level was recorded", () => {
    rendered = renderNameCell(
      makeStudent({
        active_disciplines: [
          makeDiscipline({
            id: KARATE_ENROLLMENT_ID,
            discipline_name: "Karate",
            level_name: null,
            level_color: null,
          }),
        ],
      })
    );

    expect(rendered.container.querySelector('[role="img"]')).toBeNull();
    expect(rendered.container.querySelector('span[style]')).toBeNull();
    expect(rendered.container.textContent).toContain("Ana");
  });

  it("keeps the swatch border when the level has no color", () => {
    rendered = renderNameCell(
      makeStudent({
        active_disciplines: [
          makeDiscipline({
            id: KARATE_ENROLLMENT_ID,
            discipline_name: "Karate",
            level_name: "Cinturón negro",
            level_color: null,
          }),
        ],
      })
    );

    const swatch = rendered.container.querySelector('[role="img"]');
    expect(swatch).not.toBeNull();
    const strip = swatch?.querySelector<HTMLElement>(
      '[class*="border-border"]'
    );
    expect(strip).not.toBeNull();
    expect(strip?.style.backgroundColor).toBe("");
    expect(swatch?.getAttribute("aria-label")).toContain("Cinturón negro");
  });
});

describe("StudentNameCell — activation state", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("marks a pending record as Pendiente de activación", () => {
    rendered = renderNameCell(makeStudent({ activation_status: "pending" }));

    expect(rendered.container.textContent).toContain(
      STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS
    );
  });

  it("says nothing about activation once the record is activated", () => {
    rendered = renderNameCell(makeStudent({ activation_status: "active" }));

    const text = rendered.container.textContent ?? "";
    expect(text).not.toContain(
      STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS
    );
    expect(text).not.toContain(
      STUDENT_LIFECYCLE_MESSAGES.ACTIVE_ACTIVATION_STATUS
    );
  });

  it("keeps the pending badge next to the incomplete-data badge", () => {
    rendered = renderNameCell(
      makeStudent({
        activation_status: "pending",
        national_id: null,
        email: null,
      })
    );

    const text = rendered.container.textContent ?? "";
    expect(text).toContain(STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS);
    expect(text).toContain(STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE);
  });
});

describe("Student directory columns", () => {
  const baseOptions = {
    branchId: BRANCH_ID,
    branches: BRANCHES,
    status: "active" as const,
    canManage: true,
    onActivated: vi.fn(),
    timeZone: TIME_ZONE,
  };

  function columnHeaders(
    columns: ReturnType<typeof getStudentColumns>
  ): string[] {
    return columns.flatMap((column) =>
      typeof column.header === "string" ? [column.header] : []
    );
  }

  function columnIdentifiers(
    columns: ReturnType<typeof getStudentColumns>
  ): (string | undefined)[] {
    return columns.map((column) =>
      "accessorKey" in column && column.accessorKey !== undefined
        ? String(column.accessorKey)
        : column.id
    );
  }

  it("drops the Estado column from the directory table", () => {
    const columns = getStudentColumns(baseOptions);

    expect(columnHeaders(columns)).not.toContain(
      STUDENT_DIRECTORY_MESSAGES.STATUS
    );
    expect(columnIdentifiers(columns)).not.toContain("status");
  });

  it("drops the always-on Activación column", () => {
    const columns = getStudentColumns(baseOptions);

    expect(columnHeaders(columns)).not.toContain(
      STUDENT_LIFECYCLE_MESSAGES.ACTIVATION_STATUS_LABEL
    );
    expect(columnIdentifiers(columns)).not.toContain("activation_status");
  });

  it("keeps the columns the directory still shows", () => {
    const headers = columnHeaders(getStudentColumns(baseOptions));

    expect(headers).toEqual([
      STUDENT_DIRECTORY_MESSAGES.ACTIONS,
      STUDENT_DIRECTORY_MESSAGES.FIRST_NAME,
      STUDENT_DIRECTORY_MESSAGES.SURNAME,
      STUDENT_DIRECTORY_MESSAGES.NATIONAL_ID,
      STUDENT_DIRECTORY_MESSAGES.DISCIPLINES,
      STUDENT_DIRECTORY_MESSAGES.MONTHLY_DUE_DATE,
    ]);
  });
});
