// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_VALIDATION_MESSAGES } from "@/lib/localization/es-ec";
import type { MonthlyPaymentValidationRow } from "@/lib/domain/payments/validation-actions";

// jsdom does not implement PointerEvent; Base UI's checkbox dispatches one on
// click, so fall back to MouseEvent before rendering anything.
if (typeof globalThis.PointerEvent === "undefined") {
  (
    globalThis as unknown as Record<string, unknown>
  ).PointerEvent = MouseEvent;
}

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const ENROLLMENT_A = "dddddddd-1111-2222-8333-444444444444";
const ENROLLMENT_B = "dddddddd-2222-3333-8333-444444444444";

const mocks = vi.hoisted(() => ({
  suspendOverdueEnrollments: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/payments/validation-actions", () => ({
  suspendOverdueEnrollments: mocks.suspendOverdueEnrollments,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { PaymentValidationSuspendTable } from "./payment-validation-suspend-table";

// SUSPEND_SELECTED("") is "Suspender seleccionadas ()"; strip the empty count.
const SUSPEND_BUTTON_PREFIX = PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED("").replace(
  " ()",
  ""
);

const ROW_A: MonthlyPaymentValidationRow = {
  student_discipline_id: ENROLLMENT_A,
  student_id: "cccccccc-1111-2222-8333-444444444444",
  student_name: "Ana Torres",
  discipline_name: "Karate",
  next_due_date: "2026-09-01",
  days_overdue: 10,
  grace_deadline: "2026-09-04",
};

const ROW_B: MonthlyPaymentValidationRow = {
  student_discipline_id: ENROLLMENT_B,
  student_id: "cccccccc-9999-2222-8333-444444444444",
  student_name: "Bruno Vega",
  discipline_name: "Yoga",
  next_due_date: "2026-09-02",
  days_overdue: 9,
  grace_deadline: "2026-09-05",
};

interface RenderedTable {
  container: HTMLDivElement;
  unmount(): void;
}

function renderTable(
  props: Partial<Parameters<typeof PaymentValidationSuspendTable>[0]> = {}
): RenderedTable {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <PaymentValidationSuspendTable
        rows={[ROW_A, ROW_B]}
        branchId={BRANCH_ID}
        {...props}
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

function queryCheckboxes(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'),
  ];
}

function querySuspendButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.textContent?.includes(SUSPEND_BUTTON_PREFIX)
  );
}

function queryRowCheckboxByRow(container: HTMLElement, index: number) {
  return container.querySelectorAll<HTMLButtonElement>(
    '[data-slot="table-body"] [role="checkbox"]'
  )[index];
}

function queryConfirmButton(): HTMLButtonElement | undefined {
  const content = document.querySelector('[data-slot="alert-dialog-content"]');
  if (!content) return undefined;
  return [...content.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.textContent?.includes(
        PAYMENT_VALIDATION_MESSAGES.CONFIRM_SUSPEND
      )
  );
}

function queryNotesTextarea(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(
    "#payment-validation-notes"
  );
}

function click(checkbox: HTMLButtonElement) {
  act(() => {
    checkbox.click();
  });
}

describe("PaymentValidationSuspendTable", () => {
  let rendered: RenderedTable | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.suspendOverdueEnrollments.mockResolvedValue({
      success: true,
      data: { suspended_count: 2 },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("starts with the suspend button disabled and nothing selected", () => {
    rendered = renderTable();

    const suspendButton = querySuspendButton();
    expect(suspendButton?.disabled).toBe(true);
    expect(suspendButton?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED("0")
    );
    const [selectAll] = queryCheckboxes();
    expect(selectAll.getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
  });

  it("renders an accessible empty state without the table when there is nothing to suspend", () => {
    rendered = renderTable({ rows: [] });

    expect(rendered.container.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND_EMPTY
    );
    expect(rendered.container.querySelector("table")).toBeNull();
  });

  it("selects all rows from the header checkbox and reports the selected count", () => {
    rendered = renderTable();

    const [selectAll] = queryCheckboxes();
    click(selectAll);

    const rowCheckboxes = queryCheckboxes().slice(1);
    expect(rowCheckboxes).toHaveLength(2);
    for (const checkbox of rowCheckboxes) {
      expect(checkbox.getAttribute("aria-checked")).toBe("true");
    }
    expect(queryCheckboxes()[0].getAttribute("aria-checked")).toBe("true");
    expect(querySuspendButton()?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED("2")
    );
  });

  it("marks the header checkbox as mixed when the selection is partial", () => {
    rendered = renderTable();

    const firstRowCheckbox = queryRowCheckboxByRow(rendered.container, 0);
    expect(firstRowCheckbox.getAttribute("aria-label")).toBe(
      PAYMENT_VALIDATION_MESSAGES.SELECT_ROW_ARIA(
        ROW_A.student_name,
        ROW_A.discipline_name
      )
    );

    click(firstRowCheckbox);

    expect(queryCheckboxes()[0].getAttribute("aria-checked")).toBe("mixed");
    expect(querySuspendButton()?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED("1")
    );

    // Clicking the mixed header selects every row.
    click(queryCheckboxes()[0]);
    expect(queryCheckboxes()[0].getAttribute("aria-checked")).toBe("true");
    expect(querySuspendButton()?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED("2")
    );

    // Clicking it again clears the selection.
    click(queryCheckboxes()[0]);
    expect(queryCheckboxes()[0].getAttribute("aria-checked")).toBe("false");
    expect(querySuspendButton()?.disabled).toBe(true);
  });

  it("suspends the selected enrollments with the notes and clears the selection", async () => {
    rendered = renderTable();

    click(queryRowCheckboxByRow(rendered.container, 0));
    click(queryRowCheckboxByRow(rendered.container, 1));

    act(() => {
      querySuspendButton()?.click();
    });
    const content = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    );
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_DIALOG_DESCRIPTION("2")
    );

    const notes = queryNotesTextarea();
    expect(notes).not.toBeNull();
    const notesValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    act(() => {
      notesValueSetter?.call(notes, "Falta de pago");
      notes?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      queryConfirmButton()?.click();
    });
    await act(async () => {});

    expect(mocks.suspendOverdueEnrollments).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      student_discipline_ids: [ENROLLMENT_A, ENROLLMENT_B],
      notes: "Falta de pago",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      PAYMENT_VALIDATION_MESSAGES.SUSPEND_SUCCESS("2")
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    expect(querySuspendButton()?.disabled).toBe(true);
  });

  it("keeps the dialog open and shows the server error without suspending twice", async () => {
    mocks.suspendOverdueEnrollments.mockResolvedValue({
      success: false,
      error: PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST,
    });
    rendered = renderTable();

    click(queryRowCheckboxByRow(rendered.container, 1));
    act(() => {
      querySuspendButton()?.click();
    });

    await act(async () => {
      queryConfirmButton()?.click();
    });
    await act(async () => {});

    expect(mocks.suspendOverdueEnrollments).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      student_discipline_ids: [ENROLLMENT_B],
      notes: undefined,
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      document.querySelector('[role="alert"]')?.textContent
    ).toContain(PAYMENT_VALIDATION_MESSAGES.SUSPEND_STALE_LIST);
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).not.toBeNull();
  });
});
