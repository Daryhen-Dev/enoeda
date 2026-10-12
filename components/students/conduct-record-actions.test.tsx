// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec";
import type { ConductRecord } from "@/lib/domain/conduct";

const mocks = vi.hoisted(() => ({
  markFinePaid: vi.fn(),
  voidConductRecord: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/conduct", () => ({
  CONDUCT_KINDS: { FINE: "fine", WARNING: "warning" },
  CONDUCT_STATUSES: { PENDING: "pending", PAID: "paid", ISSUED: "issued" },
  markFinePaid: mocks.markFinePaid,
  voidConductRecord: mocks.voidConductRecord,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: vi.fn(),
  },
}));

import { ConductRecordActions } from "./conduct-record-actions";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const PENDING_FINE: ConductRecord = {
  id: "cccccccc-1111-2222-8333-444444444444",
  student_id: "dddddddd-1111-2222-8333-444444444444",
  kind: "fine",
  reason: "Retrasó el equipo",
  incident_date: new Date("2026-01-05T00:00:00.000Z"),
  amount: 5,
  status: "pending",
  paid_at: null,
  paid_by: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  created_by: "eeeeeeee-1111-2222-8333-444444444444",
  created_at: new Date("2026-01-05T10:00:00.000Z"),
  updated_at: new Date("2026-01-05T10:00:00.000Z"),
};

const WARNING: ConductRecord = {
  ...PENDING_FINE,
  id: "cccccccc-3333-2222-8333-444444444444",
  kind: "warning",
  amount: null,
  status: "issued",
};

interface RenderedActions {
  container: HTMLDivElement;
  unmount(): void;
}

function renderActions(record: ConductRecord): RenderedActions {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ConductRecordActions record={record} branchId={BRANCH_ID} />);
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

function queryButtonByText(container: HTMLElement | Document, text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes(text)
  );
}

function setInputValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ConductRecordActions", () => {
  let rendered: RenderedActions | undefined;

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

  it("marks a pending fine as paid after confirmation", async () => {
    mocks.markFinePaid.mockResolvedValue({ success: true, data: { id: PENDING_FINE.id } });

    rendered = renderActions(PENDING_FINE);

    const trigger = queryButtonByText(
      rendered.container,
      CONDUCT_MESSAGES.MARK_PAID_ACTION
    );
    expect(trigger).toBeDefined();

    act(() => {
      trigger!.click();
    });

    const dialogContent = document.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-content"]'
    );
    expect(dialogContent).not.toBeNull();
    expect(dialogContent!.textContent).toContain(
      CONDUCT_MESSAGES.MARK_PAID_DESCRIPTION
    );

    const confirm = queryButtonByText(
      dialogContent!,
      CONDUCT_MESSAGES.MARK_PAID_CONFIRM
    );
    expect(confirm).toBeDefined();

    await act(async () => {
      confirm!.click();
    });
    await act(async () => {});

    expect(mocks.markFinePaid).toHaveBeenCalledWith({
      id: PENDING_FINE.id,
      branch_id: BRANCH_ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TOAST_MESSAGES.FINE_MARKED_PAID
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("does not render the mark-paid action for warnings", () => {
    rendered = renderActions(WARNING);

    expect(
      queryButtonByText(rendered.container, CONDUCT_MESSAGES.MARK_PAID_ACTION)
    ).toBeUndefined();
  });

  it("requires a reason before voiding a record", async () => {
    mocks.voidConductRecord.mockResolvedValue({ success: true, data: { id: WARNING.id } });

    rendered = renderActions(WARNING);

    const trigger = queryButtonByText(
      rendered.container,
      CONDUCT_MESSAGES.VOID_ACTION
    );
    expect(trigger).toBeDefined();

    act(() => {
      trigger!.click();
    });

    const dialogContent = document.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]'
    );
    expect(dialogContent).not.toBeNull();
    expect(dialogContent!.textContent).toContain(
      CONDUCT_MESSAGES.VOID_DESCRIPTION
    );

    const confirm = queryButtonByText(
      dialogContent!,
      CONDUCT_MESSAGES.VOID_CONFIRM
    );
    expect(confirm).toBeDefined();

    // Submitting without a reason is rejected client-side.
    await act(async () => {
      confirm!.click();
    });
    await act(async () => {});

    expect(mocks.voidConductRecord).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      CONDUCT_MESSAGES.VOID_REASON_REQUIRED
    );

    const textarea = dialogContent!.querySelector<HTMLTextAreaElement>(
      "textarea"
    );
    expect(textarea).not.toBeNull();

    await act(async () => {
      setInputValue(textarea!, "  Fue un error de registro  ");
    });
    await act(async () => {
      confirm!.click();
    });
    await act(async () => {});

    expect(mocks.voidConductRecord).toHaveBeenCalledWith({
      id: WARNING.id,
      branch_id: BRANCH_ID,
      void_reason: "Fue un error de registro",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TOAST_MESSAGES.CONDUCT_VOIDED
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
