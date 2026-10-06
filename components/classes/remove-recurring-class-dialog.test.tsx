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
  deactivateScheduledClassSeries: vi.fn(),
  deactivateAllFutureClasses: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  deactivateScheduledClass: mocks.deactivateScheduledClass,
  deactivateScheduledClassSeries: mocks.deactivateScheduledClassSeries,
  deactivateAllFutureClasses: mocks.deactivateAllFutureClasses,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import {
  RemoveRecurringClassDialog,
} from "./remove-recurring-class-dialog";

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

function queryScopeRadio(content: HTMLElement, scope: string) {
  return content.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${scope}"]`
  );
}

function queryConfirmButton(content: HTMLElement) {
  return [...content.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.textContent?.includes(REMOVE_RECURRING_CLASS_MESSAGES.CONFIRM_ACTION)
  );
}

async function confirm() {
  const confirmButton = queryConfirmButton(queryDialogContent()!);
  expect(confirmButton).toBeDefined();

  await act(async () => {
    confirmButton?.click();
  });
  await act(async () => {});
}

describe("RemoveRecurringClassDialog", () => {
  let rendered: RenderedDialog | undefined;

  function openDialog(): HTMLElement {
    act(() => {
      rendered?.container.querySelector("button")?.click();
    });
    return queryDialogContent()!;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.deactivateScheduledClass.mockResolvedValue({
      success: true,
      data: { id: SCHEDULED_CLASS_ID },
    });
    mocks.deactivateScheduledClassSeries.mockResolvedValue({
      success: true,
      data: { deactivated: 3 },
    });
    mocks.deactivateAllFutureClasses.mockResolvedValue({
      success: true,
      data: { deactivated: 5 },
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

    const content = openDialog();

    expect(content.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_TITLE
    );
    expect(content.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_DESCRIPTION
    );
  });

  it("renders three scope radios with series as default and concurrencias wording", () => {
    rendered = renderDialog();

    const content = openDialog();

    expect(queryScopeRadio(content, "series")).toBeDefined();
    expect(queryScopeRadio(content, "single")).toBeDefined();
    expect(queryScopeRadio(content, "all")).toBeDefined();
    expect(queryScopeRadio(content, "series")?.checked).toBe(true);
    // Round-4 copy: the recurring series is called "concurrencia".
    expect(content.textContent).toContain("¿Quitar la concurrencia?");
    expect(content.textContent).toContain("Toda la concurrencia (toda la semana)");
    expect(content.textContent).toContain("Todas las concurrencias de la sucursal");
    expect(content.textContent).toContain(
      REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_ALL_HINT
    );
  });

  it("confirms with the default series scope via deactivateScheduledClassSeries", async () => {
    rendered = renderDialog();

    openDialog();
    await confirm();

    expect(mocks.deactivateScheduledClassSeries).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      scheduled_class_id: SCHEDULED_CLASS_ID,
    });
    expect(mocks.deactivateScheduledClass).not.toHaveBeenCalled();
    expect(mocks.deactivateAllFutureClasses).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS_SERIES
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(queryDialogContent()).toBeNull();
  });

  it("calls deactivateScheduledClass when the single scope is selected", async () => {
    rendered = renderDialog();

    const content = openDialog();
    const singleRadio = queryScopeRadio(content, "single");
    expect(singleRadio).toBeDefined();

    act(() => {
      singleRadio?.click();
    });
    expect(singleRadio?.checked).toBe(true);

    await confirm();

    expect(mocks.deactivateScheduledClass).toHaveBeenCalledWith({
      id: SCHEDULED_CLASS_ID,
      branch_id: BRANCH_ID,
    });
    expect(mocks.deactivateScheduledClassSeries).not.toHaveBeenCalled();
    expect(mocks.deactivateAllFutureClasses).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(queryDialogContent()).toBeNull();
  });

  it("calls deactivateAllFutureClasses when the all scope is selected", async () => {
    rendered = renderDialog();

    const content = openDialog();
    const allRadio = queryScopeRadio(content, "all");
    expect(allRadio).toBeDefined();

    act(() => {
      allRadio?.click();
    });
    expect(allRadio?.checked).toBe(true);

    await confirm();

    expect(mocks.deactivateAllFutureClasses).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
    });
    expect(mocks.deactivateScheduledClass).not.toHaveBeenCalled();
    expect(mocks.deactivateScheduledClassSeries).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS_ALL
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(queryDialogContent()).toBeNull();
  });

  it("keeps the dialog open and shows the error path on failure", async () => {
    mocks.deactivateScheduledClassSeries.mockResolvedValue({
      success: false,
      error: "La clase solicitada no existe o no tiene permisos para accederla.",
    });
    rendered = renderDialog();

    openDialog();
    await confirm();

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      document.querySelector('[role="alert"]')?.textContent
    ).toBe("La clase solicitada no existe o no tiene permisos para accederla.");
    expect(queryDialogContent()).not.toBeNull();
  });
});
