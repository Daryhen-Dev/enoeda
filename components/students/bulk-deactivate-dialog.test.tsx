// @vitest-environment jsdom

/**
 * BulkDeactivateDialog — S4 bulk contract.
 *
 * Selecting several directory rows and deactivating them shares the single-row
 * pattern: one confirmation naming the students, one all-or-nothing server
 * call, and one undo toast that walks the same batch back.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STUDENT_BULK_ACTIONS_MESSAGES,
  UNDO_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const ANA_ID = "cccccccc-1111-4222-8333-444444444441";
const BRUNO_ID = "cccccccc-2222-4222-8333-444444444442";
const CARLA_ID = "cccccccc-3333-4222-8333-444444444443";
const DIEGO_ID = "cccccccc-4444-4222-8333-444444444444";

const STUDENTS = [
  { id: ANA_ID, first_name: "Ana", surname: "Torres" },
  { id: BRUNO_ID, first_name: "Bruno", surname: "Vega" },
  { id: CARLA_ID, first_name: "Carla", surname: "Ríos" },
  { id: DIEGO_ID, first_name: "Diego", surname: "Mora" },
];

const mocks = vi.hoisted(() => ({
  deactivateStudents: vi.fn(),
  reactivateStudent: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  onOpenChange: vi.fn(),
  onDeactivated: vi.fn(),
}));

vi.mock("@/lib/domain/students/actions", () => ({
  deactivateStudents: mocks.deactivateStudents,
  reactivateStudent: mocks.reactivateStudent,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { BulkDeactivateDialog } from "./bulk-deactivate-dialog";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function dialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="alert-dialog-content"]'
  );
}

function confirmButton(): HTMLButtonElement | undefined {
  const content = dialogContent();
  if (!content) return undefined;

  return [...content.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.textContent?.includes(
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
  );
}

async function confirmDeactivation() {
  await act(async () => {
    confirmButton()?.click();
  });
  await act(async () => {});
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.deactivateStudents.mockResolvedValue({
    success: true,
    data: { deactivated: STUDENTS.length },
  });
  mocks.reactivateStudent.mockResolvedValue({ success: true, data: {} });

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <BulkDeactivateDialog
        students={STUDENTS}
        branchId={BRANCH_ID}
        open
        onOpenChange={mocks.onOpenChange}
        onDeactivated={mocks.onDeactivated}
      />
    );
  });
});

afterEach(() => {
  act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe("BulkDeactivateDialog", () => {
  it("names the count and the first three students plus the remainder", () => {
    const text = dialogContent()?.textContent ?? "";

    expect(text).toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_TITLE(STUDENTS.length)
    );
    expect(text).toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_NAMES(
        ["Ana Torres", "Bruno Vega", "Carla Ríos"],
        1
      )
    );
    expect(text).toContain(STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_DESCRIPTION);
  });

  it("calls the action with exactly the selected ids and the branch", async () => {
    await confirmDeactivation();

    expect(mocks.deactivateStudents).toHaveBeenCalledTimes(1);
    expect(mocks.deactivateStudents).toHaveBeenCalledWith({
      student_ids: [ANA_ID, BRUNO_ID, CARLA_ID, DIEGO_ID],
      branch_id: BRANCH_ID,
    });
  });

  it("shows the undo affordance with the batch message on success", async () => {
    await confirmDeactivation();

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATED(STUDENTS.length),
      expect.objectContaining({
        action: expect.objectContaining({ label: UNDO_MESSAGES.UNDO_LABEL }),
      })
    );
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.onDeactivated).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("reactivates every selected student once when the batch is undone", async () => {
    await confirmDeactivation();

    const options = mocks.toastSuccess.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });

    expect(mocks.reactivateStudent).toHaveBeenCalledTimes(STUDENTS.length);
    for (const student of STUDENTS) {
      expect(mocks.reactivateStudent).toHaveBeenCalledWith({
        id: student.id,
        branch_id: BRANCH_ID,
      });
    }
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      UNDO_MESSAGES.STUDENT_DEACTIVATED_UNDONE
    );
  });

  it("reports a partial undo failure instead of claiming success", async () => {
    mocks.reactivateStudent.mockImplementation(
      async ({ id }: { id: string }) =>
        id === CARLA_ID
          ? { success: false, error: "No autorizado" }
          : { success: true, data: {} }
    );
    await confirmDeactivation();

    const options = mocks.toastSuccess.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });

    expect(mocks.toastError).toHaveBeenCalledWith("No autorizado");
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(
      UNDO_MESSAGES.STUDENT_DEACTIVATED_UNDONE
    );
  });

  it("surfaces a failure without clearing the selection", async () => {
    mocks.deactivateStudents.mockResolvedValue({
      success: false,
      error: STUDENT_BULK_ACTIONS_MESSAGES.INACTIVE_SELECTION("Bruno Vega"),
    });

    await confirmDeactivation();

    expect(
      document.querySelector('[role="alert"]')?.textContent
    ).toContain(STUDENT_BULK_ACTIONS_MESSAGES.INACTIVE_SELECTION("Bruno Vega"));
    expect(mocks.onDeactivated).not.toHaveBeenCalled();
    expect(mocks.onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(dialogContent()).not.toBeNull();
  });
});
