// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLONE_MESSAGES,
  ROSTER_EDITOR_MESSAGES,
  ROSTER_MESSAGES,
  SCHEDULE_ONE_TIME_MESSAGES,
  SCHEDULE_SERIES_MESSAGES,
} from "@/lib/localization/es-ec";

import { SeriesList } from "./series-list";
import type { ClassSeriesView, OneTimeClassView } from "@/lib/domain/classes/actions";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const NEW_SERIES_ID = "99999999-8888-7777-8666-555555555556";
const ONE_TIME_ID = "77777777-8888-7777-8333-444444444444";
const SKIPPED_STUDENT_ID = "22222222-3333-4444-8555-666666666661";

if (typeof globalThis.PointerEvent === "undefined") {
  (
    globalThis as unknown as Record<string, unknown>
  ).PointerEvent = MouseEvent;
}

const mocks = vi.hoisted(() => ({
  cloneClassGroupToNextMonth: vi.fn(),
  deactivateAllFutureClasses: vi.fn(),
  deactivateScheduledClassSeries: vi.fn(),
  renameClassSeries: vi.fn(),
  createMonthlyClassGroup: vi.fn(),
  createOneTimeClass: vi.fn(),
  listClassRoster: vi.fn(),
  listRosterCandidates: vi.fn(),
  addStudentsToRoster: vi.fn(),
  removeStudentFromRoster: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  cloneClassGroupToNextMonth: mocks.cloneClassGroupToNextMonth,
  deactivateAllFutureClasses: mocks.deactivateAllFutureClasses,
  deactivateScheduledClassSeries: mocks.deactivateScheduledClassSeries,
  renameClassSeries: mocks.renameClassSeries,
  createMonthlyClassGroup: mocks.createMonthlyClassGroup,
  createOneTimeClass: mocks.createOneTimeClass,
}));
vi.mock("@/components/classes/one-time-class-create-dialog", () => ({
  OneTimeClassCreateDialog: () => (
    <button data-testid="one-time-class-create-dialog">Crear clase única</button>
  ),
}));
vi.mock("@/lib/domain/rosters/actions", () => ({
  listClassRoster: mocks.listClassRoster,
  listRosterCandidates: mocks.listRosterCandidates,
  addStudentsToRoster: mocks.addStudentsToRoster,
  removeStudentFromRoster: mocks.removeStudentFromRoster,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));


/** Same "current month in America/Guayaquil" computation as the component. */
function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Guayaquil",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function nextMonthOf(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Same es-EC month label as the component, e.g. "Octubre de 2026". */
function monthLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const rawLabel = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
}

const CURRENT_MONTH = currentMonth();
const NEXT_MONTH = nextMonthOf(CURRENT_MONTH);

function buildSeries(overrides: Partial<ClassSeriesView> = {}): ClassSeriesView {
  return {
    series_id: SERIES_ID,
    name: "Karate infantil",
    discipline_id: "cccccccc-1111-2222-8333-444444444444",
    discipline_name: "Karate",
    period_month: CURRENT_MONTH,
    days_of_week: [0],
    start_time: "17:00",
    default_teacher_id: null,
    teacher_name: null,
    active_row_count: 1,
    is_active: true,
    is_all_inactive: false,
    roster_student_count: 3,
    has_clone: false,
    ...overrides,
  };
}

function buildOneTimeClass(
  overrides: Partial<OneTimeClassView> = {}
): OneTimeClassView {
  return {
    one_time_class_id: ONE_TIME_ID,
    class_date: "2026-11-05",
    start_time: "09:30",
    discipline_id: "cccccccc-1111-2222-8333-444444444444",
    discipline_name: "Karate",
    teacher_id: null,
    teacher_name: null,
    roster_student_count: 4,
    ...overrides,
  };
}

/** Same es-EC date label as the component, e.g. "5 de noviembre de 2026". */
function oneTimeDateLabel(classDate: string): string {
  const [year, month, day] = classDate.split("-").map(Number);
  const rawLabel = new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
}

function renderList(
  series: ClassSeriesView[],
  options: {
    defaultTeacherId?: string | null;
    oneTimeClasses?: OneTimeClassView[];
  } = {}
): { unmount(): void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SeriesList
        branchId={BRANCH_ID}
        series={series}
        disciplines={[{ id: "cccccccc-1111-2222-8333-444444444444", name: "Karate" }]}
        teachers={[]}
        defaultTeacherId={options.defaultTeacherId ?? null}
        oneTimeClasses={options.oneTimeClasses ?? []}
      />
    );
  });

  return {
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {});
  await act(async () => {});
}

function queryButtonWithText(text: string): HTMLButtonElement | undefined {
  return (
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes(text)
    ) ?? undefined
  );
}

async function clickButton(
  button: HTMLButtonElement | null | undefined
) {
  expect(button).toBeDefined();
  await act(async () => {
    button?.click();
  });
  await flush();
}

describe("SeriesList roster + clone actions", () => {
  let rendered: { unmount(): void } | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.listClassRoster.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
    mocks.listRosterCandidates.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("opens the roster editor from the Alumnos (N) button and loads the roster", async () => {
    rendered = renderList([buildSeries()]);
    await flush();

    const rosterButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${SCHEDULE_SERIES_MESSAGES.ROSTER_BUTTON_ARIA_LABEL(
        "Karate infantil",
        3
      )}"]`
    );
    expect(rosterButton?.textContent).toContain(
      `${SCHEDULE_SERIES_MESSAGES.ROSTER_ACTION} (3)`
    );
    await clickButton(rosterButton);

    expect(mocks.listClassRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "series",
      series_id: SERIES_ID,
    });
    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.SERIES_TITLE
    );
    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.ROSTER_EMPTY_TITLE
    );
  });

  it("clones to the next month, reports skipped students and opens the new group's roster editor", async () => {
    mocks.cloneClassGroupToNextMonth.mockResolvedValue({
      success: true,
      data: {
        series_id: NEW_SERIES_ID,
        period_month: NEXT_MONTH,
        class_ids: ["row-1"],
        copied_student_count: 2,
        skipped: [
          {
            student_id: SKIPPED_STUDENT_ID,
            first_name: "Bruno",
            surname: "Yánez",
            reason: "inactive",
          },
        ],
      },
    });
    rendered = renderList([buildSeries()]);
    await flush();

    await clickButton(queryButtonWithText(SCHEDULE_SERIES_MESSAGES.CLONE_ACTION));

    // Confirm dialog names source and target month.
    const confirmDialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    );
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog?.textContent).toContain(monthLabel(CURRENT_MONTH));
    expect(confirmDialog?.textContent).toContain(monthLabel(NEXT_MONTH));

    const confirmButton = [
      ...confirmDialog!.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.includes(SCHEDULE_SERIES_MESSAGES.CLONE_CONFIRM)
    );
    await clickButton(confirmButton);

    expect(mocks.cloneClassGroupToNextMonth).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      series_id: SERIES_ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      CLONE_MESSAGES.SUCCESS_SUMMARY(NEXT_MONTH, 2, 1)
    );

    // Skipped-students report dialog.
    const skippedDialog = document.querySelector(
      '[data-slot="dialog-content"]'
    );
    expect(skippedDialog).not.toBeNull();
    expect(skippedDialog?.textContent).toContain(
      SCHEDULE_SERIES_MESSAGES.SKIPPED_TITLE
    );
    expect(skippedDialog?.textContent).toContain("Bruno Yánez");
    expect(skippedDialog?.textContent).toContain(
      ROSTER_MESSAGES.SKIPPED_INACTIVE
    );

    // Follow-up: edit the new group's roster.
    await clickButton(
      [...skippedDialog!.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) =>
          button.textContent?.includes(
            SCHEDULE_SERIES_MESSAGES.EDIT_NEW_GROUP_ACTION
          )
      )
    );

    expect(mocks.listClassRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "series",
      series_id: NEW_SERIES_ID,
    });
    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.SERIES_TITLE
    );
  });

  it("clones without the skipped report when nobody was skipped", async () => {
    mocks.cloneClassGroupToNextMonth.mockResolvedValue({
      success: true,
      data: {
        series_id: NEW_SERIES_ID,
        period_month: NEXT_MONTH,
        class_ids: ["row-1"],
        copied_student_count: 2,
        skipped: [],
      },
    });
    rendered = renderList([buildSeries()]);
    await flush();

    await clickButton(queryButtonWithText(SCHEDULE_SERIES_MESSAGES.CLONE_ACTION));
    const confirmDialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    );
    const confirmButton = [
      ...confirmDialog!.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.includes(SCHEDULE_SERIES_MESSAGES.CLONE_CONFIRM)
    );
    await clickButton(confirmButton);

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      CLONE_MESSAGES.SUCCESS_SUMMARY(NEXT_MONTH, 2, 0)
    );
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(mocks.listClassRoster).not.toHaveBeenCalled();
  });

  it("disables the clone action when the group was already cloned or is inactive", async () => {
    rendered = renderList([
      buildSeries({ has_clone: true }),
      buildSeries({
        series_id: "99999999-8888-7777-8666-555555555566",
        name: "Yoga — 08:00",
        is_active: false,
        is_all_inactive: true,
        active_row_count: 0,
        days_of_week: [],
      }),
    ]);
    await flush();

    const cloneButtons = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((button) =>
      button.textContent?.includes(SCHEDULE_SERIES_MESSAGES.CLONE_ACTION)
    );
    expect(cloneButtons).toHaveLength(2);
    for (const button of cloneButtons) {
      expect(button.disabled).toBe(true);
    }
  });

  it("keeps the clone action enabled for an active, not-yet-cloned group", async () => {
    rendered = renderList([buildSeries()]);
    await flush();

    const cloneButton = queryButtonWithText(
      SCHEDULE_SERIES_MESSAGES.CLONE_ACTION
    );
    expect(cloneButton?.disabled).toBe(false);
  });
});

describe("SeriesList one-time classes section", () => {
  let rendered: { unmount(): void } | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.listClassRoster.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
    mocks.listRosterCandidates.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders both the monthly-group and the one-time class create dialogs in the header", async () => {
    rendered = renderList([buildSeries()]);
    await flush();

    expect(document.querySelector('[data-testid="one-time-class-create-dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Crear clase única");
    expect(document.body.textContent).toContain("Crear grupo mensual de clases");
  });

  it("renders the upcoming one-time classes section with date, time, discipline, teacher and roster count", async () => {
    rendered = renderList([buildSeries()], {
      oneTimeClasses: [
        buildOneTimeClass({
          teacher_id: "dddddddd-1111-2222-8333-444444444444",
          teacher_name: "María Pérez",
        }),
      ],
    });
    await flush();

    expect(document.body.textContent).toContain(
      SCHEDULE_ONE_TIME_MESSAGES.SECTION_TITLE
    );
    expect(document.body.textContent).toContain(oneTimeDateLabel("2026-11-05"));
    expect(document.body.textContent).toContain("09:30");
    expect(document.body.textContent).toContain("Karate");
    expect(document.body.textContent).toContain("María Pérez");
    expect(document.body.textContent).toContain(
      `${SCHEDULE_ONE_TIME_MESSAGES.ROSTER_COUNT_LABEL} (4)`
    );
  });

  it("opens the roster editor for a one-time class from its Alumnos button", async () => {
    rendered = renderList([], {
      oneTimeClasses: [buildOneTimeClass()],
    });
    await flush();

    const rosterButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${SCHEDULE_ONE_TIME_MESSAGES.ROSTER_BUTTON_ARIA_LABEL(
        oneTimeDateLabel("2026-11-05"),
        4
      )}"]`
    );
    await clickButton(rosterButton);

    expect(mocks.listClassRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "one_time",
      one_time_class_id: ONE_TIME_ID,
    });
    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.ONE_TIME_TITLE
    );
  });

  it("shows the empty-state copy when there are no upcoming one-time classes", async () => {
    rendered = renderList([buildSeries()]);
    await flush();

    expect(document.body.textContent).toContain(
      SCHEDULE_ONE_TIME_MESSAGES.EMPTY_STATE
    );
  });
});
