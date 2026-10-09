// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ROSTER_EDITOR_MESSAGES,
  ROSTER_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const SERIES_ID = "99999999-8888-7777-8666-555555555555";
const STUDENT_A = "22222222-3333-4444-8555-666666666661";
const CANDIDATE_B = "22222222-3333-4444-8555-666666666662";
const CANDIDATE_C = "22222222-3333-4444-8555-666666666663";

const mocks = vi.hoisted(() => ({
  listClassRoster: vi.fn(),
  listRosterCandidates: vi.fn(),
  addStudentsToRoster: vi.fn(),
  removeStudentFromRoster: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
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

import { RosterEditorSheet } from "./roster-editor-sheet";

// jsdom does not implement PointerEvent; Base UI's checkbox dispatches one on
// click, so fall back to MouseEvent before rendering anything.
if (typeof globalThis.PointerEvent === "undefined") {
  (
    globalThis as unknown as Record<string, unknown>
  ).PointerEvent = MouseEvent;
}

const ROSTER_STUDENT = {
  student_id: STUDENT_A,
  first_name: "Ana",
  surname: "Zapata",
  national_id: "1712345678",
  added_at: "2026-09-10T12:00:00.000Z",
};

const CANDIDATES = [
  {
    student_id: CANDIDATE_B,
    first_name: "Beto",
    surname: "Quito",
    national_id: "1712345679",
  },
  {
    student_id: CANDIDATE_C,
    first_name: "Carla",
    surname: "Ruiz",
    national_id: "1712345680",
  },
];

interface RenderedSheet {
  unmount(): void;
}

function renderSheet(
  props: Partial<Parameters<typeof RosterEditorSheet>[0]> = {}
): RenderedSheet {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <RosterEditorSheet
        branchId={BRANCH_ID}
        target={{ kind: "series", series_id: SERIES_ID }}
        open
        onOpenChange={vi.fn()}
        {...props}
      />
    );
  });
  // Flush the open-effect data loads.
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
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes(text)
  );
}

describe("RosterEditorSheet", () => {
  let rendered: RenderedSheet | undefined;

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

  it("lists the current roster with name, cédula and accessible remove buttons", async () => {
    mocks.listClassRoster.mockResolvedValue({
      success: true,
      data: { students: [ROSTER_STUDENT] },
    });
    rendered = renderSheet();
    await flush();

    expect(mocks.listClassRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "series",
      series_id: SERIES_ID,
    });
    expect(document.body.textContent).toContain("Zapata Ana");
    expect(document.body.textContent).toContain("1712345678");
    expect(
      document.querySelector<HTMLButtonElement>(
        `button[aria-label="${ROSTER_EDITOR_MESSAGES.REMOVE_ARIA_LABEL(
          "Ana Zapata"
        )}"]`
      )
    ).toBeDefined();
  });

  it("shows the roster empty state when no students are assigned yet", async () => {
    rendered = renderSheet();
    await flush();

    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.ROSTER_EMPTY_TITLE
    );
    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.ROSTER_EMPTY_DESCRIPTION
    );
  });

  it("adds selected candidates and renders the skipped summary with localized reasons", async () => {
    mocks.listRosterCandidates.mockResolvedValue({
      success: true,
      data: { students: CANDIDATES },
    });
    mocks.addStudentsToRoster.mockResolvedValue({
      success: true,
      data: {
        added: [CANDIDATE_B],
        skipped: [{ student_id: CANDIDATE_C, reason: "not_eligible" }],
      },
    });
    rendered = renderSheet();
    await flush();

    const checkboxes = [
      ...document.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    ];
    expect(checkboxes).toHaveLength(2);
    act(() => {
      checkboxes[0]?.click();
      checkboxes[1]?.click();
    });

    const addButton = queryButtonWithText(
      ROSTER_EDITOR_MESSAGES.ADD_SELECTED_ACTION
    );
    expect(addButton).toBeDefined();
    await act(async () => {
      addButton?.click();
    });
    await flush();

    expect(mocks.addStudentsToRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "series",
      series_id: SERIES_ID,
      student_ids: [CANDIDATE_B, CANDIDATE_C],
    });
    const summary = document.querySelector('[role="status"][aria-live="polite"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.ADD_SUCCESS(1)
    );
    expect(summary?.textContent).toContain("Carla Ruiz");
    expect(summary?.textContent).toContain(
      ROSTER_MESSAGES.SKIPPED_NOT_ELIGIBLE
    );
  });

  it("removes a student after confirmation and reloads the roster", async () => {
    mocks.listClassRoster.mockResolvedValue({
      success: true,
      data: { students: [ROSTER_STUDENT] },
    });
    mocks.removeStudentFromRoster.mockResolvedValue({
      success: true,
      data: { removed: true },
    });
    rendered = renderSheet();
    await flush();

    const removeButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${ROSTER_EDITOR_MESSAGES.REMOVE_ARIA_LABEL(
        "Ana Zapata"
      )}"]`
    );
    expect(removeButton).toBeDefined();
    act(() => {
      removeButton?.click();
    });

    const confirmDialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    );
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog?.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.REMOVE_CONFIRM_TITLE
    );
    expect(confirmDialog?.textContent).toContain("Ana Zapata");

    const confirmButton = [
      ...confirmDialog!.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.includes(ROSTER_EDITOR_MESSAGES.REMOVE_CONFIRM_ACTION)
    );
    expect(confirmButton).toBeDefined();
    await act(async () => {
      confirmButton?.click();
    });
    await flush();

    expect(mocks.removeStudentFromRoster).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      kind: "series",
      series_id: SERIES_ID,
      student_id: STUDENT_A,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      ROSTER_EDITOR_MESSAGES.REMOVE_SUCCESS
    );
    // Roster loaded on open + reload after removal.
    expect(mocks.listClassRoster).toHaveBeenCalledTimes(2);
  });

  it("shows the candidates empty hint when nobody is eligible", async () => {
    rendered = renderSheet();
    await flush();

    expect(document.body.textContent).toContain(
      ROSTER_EDITOR_MESSAGES.CANDIDATES_EMPTY
    );
  });

  it("renders an error alert with the server copy when the roster fails to load", async () => {
    mocks.listClassRoster.mockResolvedValue({
      success: false,
      error: "No se pudo cargar",
    });
    rendered = renderSheet();
    await flush();

    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "No se pudo cargar"
    );
  });
});
