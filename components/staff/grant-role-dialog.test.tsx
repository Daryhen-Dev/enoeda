// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  createBranchTeacher: vi.fn(),
  assignTeacherToExistingAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));
vi.mock("@/lib/domain/roles/actions", () => ({
  createBranchTeacher: mocks.createBranchTeacher,
  assignTeacherToExistingAccount: mocks.assignTeacherToExistingAccount,
}));
vi.mock("@/components/owner/created-account-dialog", () => ({
  CreatedAccountDialog: ({ credentials }: { credentials: unknown }) =>
    credentials ? <div data-testid="created-account-dialog" /> : null,
}));

import { GrantRoleDialog } from "./grant-role-dialog";
import { TEACHER_MANAGEMENT_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "aaaaaaaa-1111-2222-8333-444444444444";
const EMAIL = "profesor@ejemplo.com";

interface RenderedDialog {
  container: HTMLDivElement;
  unmount(): void;
}

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderDialog(): RenderedDialog {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<GrantRoleDialog branchId={BRANCH_ID} />);
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

function findButtonByText(rendered: RenderedDialog, text: string) {
  return Array.from(document.body.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

async function openDialog(rendered: RenderedDialog) {
  const trigger = findButtonByText(
    rendered,
    TEACHER_MANAGEMENT_MESSAGES.ASSIGN_ACTION
  );
  expect(trigger).toBeDefined();
  await act(async () => {
    trigger!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
}

function fillRequiredFields() {
  setValue(document.querySelector<HTMLInputElement>("#teacher-email")!, EMAIL);
  setValue(
    document.querySelector<HTMLInputElement>("#teacher-first-name")!,
    "Ana"
  );
  setValue(
    document.querySelector<HTMLInputElement>("#teacher-surname")!,
    "Pérez"
  );
  setValue(
    document.querySelector<HTMLInputElement>("#teacher-date-of-birth")!,
    "1990-05-01"
  );
}

function submitForm() {
  return act(async () => {
    document.body
      .querySelector("form")!
      .dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
  });
}

describe("GrantRoleDialog — existing-account mode", () => {
  let rendered: RenderedDialog | undefined;

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

  it("opens in existing-account mode by default", async () => {
    rendered = renderDialog();
    await openDialog(rendered);

    const existingItem = findButtonByText(
      rendered,
      TEACHER_MANAGEMENT_MESSAGES.MODE_EXISTING
    );
    expect(existingItem?.getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).toContain(
      TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_DESCRIPTION
    );
    const submit = findButtonByText(
      rendered,
      TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_SUBMIT
    );
    expect(submit).toBeDefined();
  });

  it("assigns the role to the existing account and never creates one", async () => {
    mocks.assignTeacherToExistingAccount.mockResolvedValue({
      success: true,
      data: { email: EMAIL },
    });
    rendered = renderDialog();
    await openDialog(rendered);
    fillRequiredFields();
    await submitForm();

    expect(mocks.assignTeacherToExistingAccount).toHaveBeenCalledWith({
      email: EMAIL,
      branchId: BRANCH_ID,
      first_name: "Ana",
      surname: "Pérez",
      phone: undefined,
      date_of_birth: "1990-05-01",
    });
    expect(mocks.createBranchTeacher).not.toHaveBeenCalled();

    // The staff list must reload, and no password dialog may appear.
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TEACHER_MANAGEMENT_MESSAGES.EXISTING_ACCOUNT_ASSIGNED_SUCCESS
    );
    expect(
      document.body.querySelector('[data-testid="created-account-dialog"]')
    ).toBeNull();

    expect(document.body.textContent).not.toContain(
      TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_DESCRIPTION
    );
  });

  it("surfaces a server error message inline and keeps the sheet open", async () => {
    mocks.assignTeacherToExistingAccount.mockResolvedValue({
      success: false,
      error: "No existe una cuenta con ese correo electrónico.",
    });
    rendered = renderDialog();
    await openDialog(rendered);
    fillRequiredFields();
    await submitForm();

    expect(
      document.body.textContent?.includes(
        "No existe una cuenta con ese correo electrónico."
      )
    ).toBe(true);
    expect(
      document.body.textContent?.includes(
        TEACHER_MANAGEMENT_MESSAGES.EXISTING_MODE_DESCRIPTION
      )
    ).toBe(true);
  });

  it("switching to create-account mode calls createBranchTeacher instead", async () => {
    mocks.createBranchTeacher.mockResolvedValue({
      success: true,
      data: { email: EMAIL, temporaryPassword: "temp-pass" },
    });
    rendered = renderDialog();
    await openDialog(rendered);

    const createItem = findButtonByText(
      rendered,
      TEACHER_MANAGEMENT_MESSAGES.MODE_CREATE
    );
    await act(async () => {
      createItem!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    fillRequiredFields();
    await submitForm();

    expect(mocks.createBranchTeacher).toHaveBeenCalledWith({
      email: EMAIL,
      branchId: BRANCH_ID,
      first_name: "Ana",
      surname: "Pérez",
      phone: undefined,
      date_of_birth: "1990-05-01",
    });
    expect(mocks.assignTeacherToExistingAccount).not.toHaveBeenCalled();

    const createdDialog = document.body.querySelector(
      "[data-testid=created-account-dialog]"
    );
    expect(createdDialog).not.toBeNull();
  });
});
