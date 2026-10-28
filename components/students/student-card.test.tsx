// @vitest-environment jsdom

/**
 * StudentCard — S2 contract.
 *
 * Below the `md` breakpoint each student renders as a stacked card with the
 * name, the incomplete-data badge, the status, the disciplines and the nearest
 * monthly due date, linking to the detail page in one tap and keeping the
 * remaining actions in the "Acciones" menu.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STUDENT_BULK_ACTIONS_MESSAGES,
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_LIFECYCLE_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
  STUDENT_ROW_ACTIONS_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-8333-444444444444";
const MONTHLY_DISCIPLINE_ID = "dddddddd-1111-4222-8333-444444444444";
const TIME_ZONE = "America/Guayaquil";

const mocks = vi.hoisted(() => ({
  activateStudent: vi.fn(),
  deactivateStudent: vi.fn(),
  reactivateStudent: vi.fn(),
  registerMonthlyPayment: vi.fn(),
  registerClassPayment: vi.fn(),
  createStudent: vi.fn(),
  findStudentsWithSameName: vi.fn(),
  getStudentById: vi.fn(),
  updateStudent: vi.fn(),
  enrollStudent: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/lib/domain/students", async () => {
  const { getMissingStudentData, hasIncompleteStudentData } = await import(
    "@/lib/domain/students/completeness"
  );

  return {
    getMissingStudentData,
    hasIncompleteStudentData,
    activateStudent: mocks.activateStudent,
    reactivateStudent: mocks.reactivateStudent,
    STUDENT_STATUS: { ACTIVE: "active", INACTIVE: "inactive" },
    STUDENT_ACTIVATION_STATUS: { PENDING: "pending", ACTIVE: "active" },
  };
});

vi.mock("@/lib/domain/students/actions", () => ({
  deactivateStudent: mocks.deactivateStudent,
  createStudent: mocks.createStudent,
  findStudentsWithSameName: mocks.findStudentsWithSameName,
  getStudentById: mocks.getStudentById,
  updateStudent: mocks.updateStudent,
}));

vi.mock("@/lib/domain/payments/actions", () => ({
  registerMonthlyPayment: mocks.registerMonthlyPayment,
  registerClassPayment: mocks.registerClassPayment,
}));

vi.mock("@/lib/domain/disciplines/actions", () => ({
  enrollStudent: mocks.enrollStudent,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

import { getCurrentDateOnly } from "@/lib/date";

import { StudentCard } from "./student-card";

const BRANCHES = [{ id: BRANCH_ID, name: "Sucursal Norte" }];

function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

const TODAY = getCurrentDateOnly(TIME_ZONE);

const BLACK_BELT_COLOR = "#7c3aed";

function makeStudent(overrides: {
  activation_status?: "active" | "pending";
  national_id?: string | null;
  email?: string | null;
  next_due_date?: string | null;
  billing_mode?: "monthly" | "per_class";
  discipline_name?: string;
  level_name?: string | null;
  level_color?: string | null;
}) {
  const billingMode = overrides.billing_mode ?? "monthly";
  const levelName =
    overrides.level_name === undefined ? "Cinturón negro" : overrides.level_name;
  const levelColor =
    overrides.level_color === undefined ? BLACK_BELT_COLOR : overrides.level_color;

  return {
    id: STUDENT_ID,
    branch_id: BRANCH_ID,
    first_name: "Ana",
    surname: "Pérez",
    national_id: overrides.national_id === undefined ? "1712345678" : overrides.national_id,
    email: overrides.email === undefined ? "ana@example.com" : overrides.email,
    date_of_birth: new Date("2010-05-04T00:00:00.000Z"),
    activation_status: overrides.activation_status ?? "active",
    active_discipline_names: [overrides.discipline_name ?? "Karate"],
    active_disciplines: [
      {
        id: MONTHLY_DISCIPLINE_ID,
        discipline_name: overrides.discipline_name ?? "Karate",
        next_due_date: overrides.next_due_date ?? null,
        billing_mode: billingMode,
        level_name: levelName,
        level_color: levelColor,
      },
    ],
  };
}

/** Browser-normalized inline color, so #7c3aed and rgb(...) compare equal. */
function normalizedColor(color: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = color;
  return probe.style.backgroundColor;
}

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderCard(
  student: ReturnType<typeof makeStudent>,
  options: {
    status?: "active" | "inactive";
    canManage?: boolean;
    /** Mirrors the directory, which always passes selection state to the card. */
    withSelection?: boolean;
  } = {}
): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <StudentCard
        student={student}
        branchId={BRANCH_ID}
        branches={BRANCHES}
        status={options.status ?? "active"}
        canManage={options.canManage ?? true}
        selected={false}
        onSelectedChange={options.withSelection === false ? undefined : vi.fn()}
        onActivated={vi.fn()}
        timeZone={TIME_ZONE}
      />
    );
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

describe("StudentCard — mobile presentation of one student", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("shows the name and one compact meta line instead of a label grid", () => {
    rendered = renderCard(
      makeStudent({ next_due_date: TODAY, discipline_name: "Karate" })
    );

    const text = rendered.container.textContent ?? "";
    expect(text).toContain("Ana Pérez");
    expect(text).toContain("Karate");
    // The active tab already says every card is active; the label grid is gone.
    expect(text).not.toContain(STUDENT_DIRECTORY_MESSAGES.DISCIPLINES);
    expect(text).not.toContain(STUDENT_DIRECTORY_MESSAGES.STATUS);
  });

  it("links the card header to the detail page keeping the branch", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    const link = rendered.container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      `/dashboard/students/${STUDENT_ID}?branch=${BRANCH_ID}`
    );
    expect(link?.textContent).toContain("Ana Pérez");
  });

  it("shows the due date with the directory wording", () => {
    rendered = renderCard(
      makeStudent({ next_due_date: shiftDateOnly(TODAY, 5) })
    );

    const text = rendered.container.textContent ?? "";
    expect(text).toContain(STUDENT_DIRECTORY_MESSAGES.DUE_IN_DAYS(5));
    expect(text).not.toContain(STUDENT_DIRECTORY_MESSAGES.MONTHLY_DUE_DATE);
  });

  it("says today when the nearest due date is today", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    expect(rendered.container.textContent).toContain(
      STUDENT_DIRECTORY_MESSAGES.DUE_TODAY
    );
  });

  it("marks a per-class-only student as billed per class", () => {
    rendered = renderCard(makeStudent({ billing_mode: "per_class" }));

    expect(rendered.container.textContent).toContain(
      STUDENT_DIRECTORY_MESSAGES.PER_CLASS_DUE_DATE
    );
  });

  it("says there are no payments when a monthly student has no due date", () => {
    rendered = renderCard(makeStudent({ next_due_date: null }));

    expect(rendered.container.textContent).toContain(
      STUDENT_DIRECTORY_MESSAGES.NO_PAYMENTS_REGISTERED
    );
  });

  it("shows the incomplete-data badge with the missing fields", () => {
    rendered = renderCard(
      makeStudent({ national_id: null, email: null, next_due_date: TODAY })
    );

    const badge = rendered.container.querySelector(
      `[aria-label^="${STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE}"]`
    );
    expect(badge).not.toBeNull();
    const missingLabels = STUDENT_MISSING_DATA_MESSAGES.MISSING_FIELD_LABELS;
    expect(badge?.getAttribute("aria-label")).toContain(
      [missingLabels.national_id, missingLabels.email].join(", ")
    );
  });

  it("shows the pending activation status", () => {
    rendered = renderCard(
      makeStudent({ activation_status: "pending", next_due_date: TODAY })
    );

    expect(rendered.container.textContent).toContain(
      STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS
    );
  });

  it("says nothing about activation once the record is activated", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    const text = rendered.container.textContent ?? "";
    expect(text).not.toContain(
      STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS
    );
    expect(text).not.toContain(
      STUDENT_LIFECYCLE_MESSAGES.ACTIVE_ACTIVATION_STATUS
    );
  });

  it("shows the belt swatch of the active discipline next to the name", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    const swatch = rendered.container.querySelector('[role="img"]');
    expect(swatch).not.toBeNull();
    const strip = swatch?.querySelector<HTMLElement>(
      '[class*="border-border"]'
    );
    expect(strip).not.toBeNull();
    expect(strip?.style.backgroundColor).toBe(
      normalizedColor(BLACK_BELT_COLOR)
    );

    const label = swatch?.getAttribute("aria-label") ?? "";
    expect(label).toContain("Cinturón negro");
    expect(label).toContain("Karate");
  });

  it("shows no swatch when the discipline has no recorded level", () => {
    rendered = renderCard(
      makeStudent({
        next_due_date: TODAY,
        level_name: null,
        level_color: null,
      })
    );

    expect(rendered.container.querySelector('[role="img"]')).toBeNull();
    expect(rendered.container.textContent).toContain("Ana Pérez");
  });

  it("keeps every action in the Acciones menu of the card", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    const trigger = rendered.container.querySelector(
      `button[aria-label="${STUDENT_ROW_ACTIONS_MESSAGES.TRIGGER_ARIA("Ana Pérez")}"]`
    );
    expect(trigger).not.toBeNull();
  });

  it("offers a selection checkbox to a manager on the active tab", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }));

    const checkbox = rendered.container.querySelector('[role="checkbox"]');
    expect(checkbox?.getAttribute("aria-label")).toBe(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECT_ROW_LABEL("Ana Pérez")
    );
    expect(checkbox?.getAttribute("aria-checked")).toBe("false");
  });

  it("hides the selection checkbox from a caller who cannot manage the branch", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }), {
      canManage: false,
    });

    expect(rendered.container.querySelector('[role="checkbox"]')).toBeNull();
  });

  it("hides the selection checkbox in the history tab", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }), {
      status: "inactive",
    });

    expect(rendered.container.querySelector('[role="checkbox"]')).toBeNull();
  });

  it("shows the inactive status and no due date in the history tab", () => {
    rendered = renderCard(makeStudent({ next_due_date: TODAY }), {
      status: "inactive",
    });

    const text = rendered.container.textContent ?? "";
    expect(text).toContain(STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS);
    expect(text).not.toContain(STUDENT_DIRECTORY_MESSAGES.MONTHLY_DUE_DATE);
  });
});
