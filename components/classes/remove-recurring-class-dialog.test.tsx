// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REMOVE_RECURRING_CLASS_MESSAGES,
} from "@/lib/localization/es-ec";

const SCHEDULED_CLASS_ID = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const mocks = vi.hoisted(() => ({
  deactivateScheduledClass: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  deactivateScheduledClass: mocks.deactivateScheduledClass,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { RemoveRecurringClassDialog } from "./remove-recurring-class-dialog";

interface RenderedDialog {
  container: HTMLDivElement;
  unmount(): void;
}

function renderDialog(): RenderedDialog {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <RemoveRecurringClassDialog
        scheduledClassId={SCHEDULED_CLASS_ID}
        branchId={BRANCH_ID}
        disciplineName="Karate"
        startTime="17:00"
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

function queryDialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="alert-dialog-content"]'
  );
}

describe("RemoveRecurringClassDialog", () => {
  let rendered: RenderedDialog | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.deactivateScheduledClass.mockResolvedValue({
      success: true,
      data: { id: SCHEDULED_CLASS_ID },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders the trigger with the accessible label", () => {
    rendered = renderDialog();

    const trigger = rendered.container.querySelector("button");
    expect(trigger?.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.ACTION
    );
    expect(trigger?.getAttribute("aria-label")).toBe(
      REMOVE_RECURRING_CLASS_MESSAGES.ARIA_LABEL("Karate", "17:00")
    );
    expect(queryDialogContent()).toBeNull();
  });

  it("shows title and description when opened", () => {
    rendered = renderDialog();

    act(() => {
      rendered?.container.querySelector("button")?.click();
    });

    const content = queryDialogContent();
    expect(content?.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_TITLE
    );
    expect(content?.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_DESCRIPTION
    );
  });

  it("confirms by deactivating the scheduled class and takes the success path", async () => {
    rendered = renderDialog();

    act(() => {
      rendered?.container.querySelector("button")?.click();
    });

    const confirmButton = [
      ...queryDialogContent()!.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.includes(
        REMOVE_RECURRING_CLASS_MESSAGES.CONFIRM_ACTION
      )
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
    });
    await act(async () => {});

    expect(mocks.deactivateScheduledClass).toHaveBeenCalledWith({
      id: SCHEDULED_CLASS_ID,
      branch_id: BRANCH_ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(queryDialogContent()).toBeNull();
  });

  it("keeps the dialog open and shows the error path on failure", async () => {
    mocks.deactivateScheduledClass.mockResolvedValue({
      success: false,
      error: "La clase solicitada no existe o no tiene permisos para accederla.",
    });
    rendered = renderDialog();

    act(() => {
      rendered?.container.querySelector("button")?.click();
    });

    const confirmButton = [
      ...queryDialogContent()!.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.includes(
        REMOVE_RECURRING_CLASS_MESSAGES.CONFIRM_ACTION
      )
    );

    await act(async () => {
      confirmButton?.click();
    });
    await act(async () => {});

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      document.querySelector('[role="alert"]')?.textContent
    ).toBe("La clase solicitada no existe o no tiene permisos para accederla.");
    expect(queryDialogContent()).not.toBeNull();
  });
});
