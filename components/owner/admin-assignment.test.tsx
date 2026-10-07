// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OWNER_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const mocks = vi.hoisted(() => ({
  createBranchAdmin: vi.fn(),
  revokeBranchRole: vi.fn(),
  assignAdminToExistingAccount: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/domain/roles/actions", () => ({
  createBranchAdmin: mocks.createBranchAdmin,
  revokeBranchRole: mocks.revokeBranchRole,
  assignAdminToExistingAccount: mocks.assignAdminToExistingAccount,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

import { AdminAssignment } from "./admin-assignment";

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderAssignment(): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AdminAssignment branchId={BRANCH_ID} admins={[]} />);
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

function queryTrigger(container: HTMLElement, label: string): HTMLButtonElement | null {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === label
  ) ?? null;
}

function querySheetContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
}

function querySubmitButton(content: HTMLElement): HTMLButtonElement | null {
  return content.querySelector<HTMLButtonElement>('button[type="submit"]');
}

function setEmail(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AdminAssignment — assign existing admin dialog", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.assignAdminToExistingAccount.mockResolvedValue({
      success: true,
      data: { email: "admin.existente@example.com" },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders both triggers in the header row and keeps the sheet closed", () => {
    rendered = renderAssignment();

    expect(queryTrigger(rendered.container, OWNER_MESSAGES.ASSIGN_ADMIN)).not.toBeNull();
    expect(
      queryTrigger(rendered.container, OWNER_MESSAGES.ASSIGN_EXISTING_ADMIN)
    ).not.toBeNull();
    expect(querySheetContent()).toBeNull();
  });

  it("opens the email-only sheet with a disabled submit until an email is typed", () => {
    rendered = renderAssignment();

    const trigger = queryTrigger(
      rendered.container,
      OWNER_MESSAGES.ASSIGN_EXISTING_ADMIN
    );
    act(() => {
      trigger?.click();
    });

    const content = querySheetContent();
    expect(content?.textContent).toContain(OWNER_MESSAGES.ASSIGN_EXISTING_ADMIN_TITLE);
    expect(content?.querySelector<HTMLInputElement>('input[type="email"]')).not.toBeNull();
    expect(querySubmitButton(content!)?.disabled).toBe(true);

    setEmail(
      content!.querySelector<HTMLInputElement>('input[type="email"]')!,
      "admin.existente@example.com"
    );
    expect(querySubmitButton(content!)?.disabled).toBe(false);
  });

  it("submits the action, toasts, refreshes, and closes on success", async () => {
    rendered = renderAssignment();

    act(() => {
      queryTrigger(rendered!.container, OWNER_MESSAGES.ASSIGN_EXISTING_ADMIN)?.click();
    });
    const content = querySheetContent()!;
    setEmail(content.querySelector<HTMLInputElement>('input[type="email"]')!, "admin.existente@example.com");

    await act(async () => {
      querySubmitButton(content)?.click();
    });
    await act(async () => {});

    expect(mocks.assignAdminToExistingAccount).toHaveBeenCalledWith({
      email: "admin.existente@example.com",
      branchId: BRANCH_ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TOAST_MESSAGES.ADMIN_CARGO_ASSIGNED_EXISTING
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(querySheetContent()).toBeNull();
  });

  it("keeps the sheet open and shows the inline error on failure", async () => {
    mocks.assignAdminToExistingAccount.mockResolvedValue({
      success: false,
      error: "Esta persona ya es administradora de esta sucursal.",
    });
    rendered = renderAssignment();

    act(() => {
      queryTrigger(rendered!.container, OWNER_MESSAGES.ASSIGN_EXISTING_ADMIN)?.click();
    });
    const content = querySheetContent()!;
    setEmail(content.querySelector<HTMLInputElement>('input[type="email"]')!, "admin.existente@example.com");

    await act(async () => {
      querySubmitButton(content)?.click();
    });
    await act(async () => {});

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(querySheetContent()).not.toBeNull();
    expect(document.getElementById("assign-existing-admin-error")?.textContent).toBe(
      "Esta persona ya es administradora de esta sucursal."
    );
  });
});
