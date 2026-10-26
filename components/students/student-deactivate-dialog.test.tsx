// @vitest-environment jsdom

/**
 * StudentDeactivateDialog — S4 contract (undo half).
 *
 * Deactivating a student confirms itself with an undo affordance, and taking it
 * reactivates the same student in the same branch instead of leaving the admin
 * to rebuild the record by hand.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STUDENT_LIFECYCLE_MESSAGES,
  TOAST_MESSAGES,
  UNDO_MESSAGES,
} from "@/lib/localization/es-ec";

const STUDENT_ID = "aaaaaaaa-1111-4222-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const mocks = vi.hoisted(() => ({
  deactivateStudent: vi.fn(),
  reactivateStudent: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/students/actions", () => ({
  deactivateStudent: mocks.deactivateStudent,
  reactivateStudent: mocks.reactivateStudent,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { StudentDeactivateDialog } from "./student-deactivate-dialog";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function dialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="alert-dialog-content"]');
}

async function confirmDeactivation() {
  act(() => {
    container!.querySelector("button")!.click();
  });
  expect(dialogContent()).not.toBeNull();

  const confirm = [
    ...(dialogContent()?.querySelectorAll("button") ?? []),
  ].find((button) =>
    button.textContent?.includes(STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_TRIGGER)
  );

  await act(async () => {
    confirm?.click();
  });
  await act(async () => {});
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.deactivateStudent.mockResolvedValue({ success: true, data: { id: STUDENT_ID } });
  mocks.reactivateStudent.mockResolvedValue({ success: true, data: { id: STUDENT_ID } });

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <StudentDeactivateDialog
        student={{ id: STUDENT_ID, first_name: "Ana", surname: "Pérez" }}
        branchId={BRANCH_ID}
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

describe("StudentDeactivateDialog undo", () => {
  it("confirms the deactivation with an undo affordance", async () => {
    await confirmDeactivation();

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TOAST_MESSAGES.STUDENT_DEACTIVATED,
      expect.objectContaining({
        action: expect.objectContaining({ label: UNDO_MESSAGES.UNDO_LABEL }),
      })
    );
  });

  it("reactivates the same student in the same branch when undone", async () => {
    await confirmDeactivation();

    const options = mocks.toastSuccess.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });

    expect(mocks.reactivateStudent).toHaveBeenCalledWith({
      id: STUDENT_ID,
      branch_id: BRANCH_ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      UNDO_MESSAGES.STUDENT_DEACTIVATED_UNDONE
    );
  });

  it("reports a rejected undo instead of claiming success", async () => {
    mocks.reactivateStudent.mockResolvedValue({
      success: false,
      error: "No autorizado",
    });
    await confirmDeactivation();

    const options = mocks.toastSuccess.mock.calls.at(-1)?.[1] as {
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
});
