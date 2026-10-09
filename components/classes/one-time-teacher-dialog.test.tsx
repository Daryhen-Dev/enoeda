// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEACHER_ASSIGN_MESSAGES } from "@/lib/localization/es-ec";

const ONE_TIME_CLASS_ID = "77777777-8888-7777-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const TEACHER_A = "dddddddd-1111-2222-8333-444444444441";
const TEACHER_B = "dddddddd-1111-2222-8333-444444444442";

const TEACHERS = [
  { id: TEACHER_A, name: "María Pérez" },
  { id: TEACHER_B, name: "Juan Loor" },
];

const mocks = vi.hoisted(() => ({
  setOneTimeClassTeacher: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  setOneTimeClassTeacher: mocks.setOneTimeClassTeacher,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { OneTimeTeacherDialog } from "./one-time-teacher-dialog";

if (typeof globalThis.PointerEvent === "undefined") {
  (
    globalThis as unknown as Record<string, unknown>
  ).PointerEvent = MouseEvent;
}

interface RenderedDialog {
  container: HTMLDivElement;
  unmount(): void;
}

function renderDialog(currentTeacherId: string | null): RenderedDialog {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <OneTimeTeacherDialog
        oneTimeClassId={ONE_TIME_CLASS_ID}
        branchId={BRANCH_ID}
        teachers={TEACHERS}
        currentTeacherId={currentTeacherId}
        trigger={<span>Abrir</span>}
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

function querySheetContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
}

/** Synchronously opens the sheet (async flushes around popup state hang jsdom). */
function openSheet() {
  const trigger = document.body.querySelector<HTMLButtonElement>(
    '[data-slot="sheet-trigger"]'
  );
  expect(trigger).toBeDefined();
  act(() => {
    trigger?.click();
  });
  const content = querySheetContent();
  expect(content).not.toBeNull();
  return content!;
}

/** Visible label of the Select's current value (rendered in the trigger). */
function selectTriggerLabel(): string {
  const trigger = document.querySelector<HTMLElement>(
    '[data-slot="select-trigger"]'
  );
  expect(trigger).toBeDefined();
  return trigger?.textContent ?? "";
}

function queryConfirmButton(content: HTMLElement) {
  return [...content.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.textContent?.includes(TEACHER_ASSIGN_MESSAGES.ONE_TIME_CONFIRM)
  );
}

async function confirmSelection(content: HTMLElement) {
  const confirmButton = queryConfirmButton(content);
  expect(confirmButton).toBeDefined();
  act(() => {
    confirmButton?.click();
  });
  // Single flush to settle the mocked action promise.
  await act(async () => {});
}

describe("OneTimeTeacherDialog", () => {
  // NOTE: tests that flush a mocked action while a sheet close animation
  // is pending can stall jsdom when run after several open/close cycles,
  // so the error-path test (no close on flush) stays near the top and
  // each test leaves the sheet closed whenever possible. Do not reorder
  // without re-running the whole file.
  let rendered: RenderedDialog | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.setOneTimeClassTeacher.mockResolvedValue({
      success: true,
      data: { id: ONE_TIME_CLASS_ID },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("keeps the sheet closed until the trigger is clicked and shows the one-time copy when open", () => {
    rendered = renderDialog(null);
    expect(querySheetContent()).toBeNull();

    const content = openSheet();

    expect(content.textContent).toContain(
      TEACHER_ASSIGN_MESSAGES.ONE_TIME_TITLE
    );
    expect(content.textContent).toContain(
      TEACHER_ASSIGN_MESSAGES.ONE_TIME_DESCRIPTION
    );
  });

  it("keeps the sheet open and shows the error on failure", async () => {
    mocks.setOneTimeClassTeacher.mockResolvedValue({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
    rendered = renderDialog(null);

    const content = openSheet();
    await confirmSelection(content);

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(content.textContent).toContain(TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED);
    expect(querySheetContent()).not.toBeNull();
  });


  it("preselects the current teacher and resets the selection after close/reopen", () => {
    rendered = renderDialog(TEACHER_A);

    const content = openSheet();
    expect(selectTriggerLabel()).toContain("María Pérez");
    expect(content.textContent).toContain(TEACHER_ASSIGN_MESSAGES.TEACHER_LABEL);

    act(() => {
      rendered?.container
        .querySelector<HTMLButtonElement>('[data-slot="sheet-trigger"]')
        ?.click();
    });
    expect(querySheetContent()).toBeNull();

    // Reopened → preselection resets to the current teacher again.
    openSheet();
    expect(selectTriggerLabel()).toContain("María Pérez");
  });

  it("submits the preselected teacher as teacher_id", async () => {
    rendered = renderDialog(TEACHER_A);

    const content = openSheet();
    await confirmSelection(content);

    expect(mocks.setOneTimeClassTeacher).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      one_time_class_id: ONE_TIME_CLASS_ID,
      teacher_id: TEACHER_A,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TEACHER_ASSIGN_MESSAGES.ONE_TIME_UPDATED
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("submits teacher_id null when the class has no teacher (preselected 'Sin profesor')", async () => {
    rendered = renderDialog(null);

    const content = openSheet();
    expect(selectTriggerLabel()).toContain(
      TEACHER_ASSIGN_MESSAGES.NO_TEACHER_OPTION
    );
    await confirmSelection(content);

    expect(mocks.setOneTimeClassTeacher).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      one_time_class_id: ONE_TIME_CLASS_ID,
      teacher_id: null,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TEACHER_ASSIGN_MESSAGES.ONE_TIME_UPDATED
    );
  });

});
