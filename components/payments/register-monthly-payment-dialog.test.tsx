// @vitest-environment jsdom

/**
 * RegisterMonthlyPaymentDialog — what happens after the payment is saved.
 *
 * For an active enrollment the confirmation names the new due date. For a
 * suspended one the same submit reactivates it, and a failed reactivation is
 * reported as "paid, still suspended" so nobody charges twice.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PAYMENT_FOLLOW_UP_MESSAGES,
  PAYMENT_MESSAGES,
  formatDate,
} from "@/lib/localization/es-ec";
import { parseDateOnly } from "@/lib/date";

const ENROLLMENT_ID = "dddddddd-1111-2222-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const mocks = vi.hoisted(() => ({
  registerMonthlyPayment: vi.fn(),
  reactivateEnrollment: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/payments/actions", () => ({
  registerMonthlyPayment: mocks.registerMonthlyPayment,
}));
vi.mock("@/lib/domain/disciplines/actions", () => ({
  reactivateEnrollment: mocks.reactivateEnrollment,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

/**
 * Writing to a base-ui Select hangs jsdom (its popup positioning never
 * settles), the same limitation the dropdown menu hit. This test is about what
 * happens AFTER the submit, so the month and year pickers become a native
 * <select> that forwards the same value contract.
 */
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  type Props = { value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode };
  const Ctx = React.createContext<Props>({});
  return {
    Select: ({ value, onValueChange, children }: Props) =>
      React.createElement(Ctx.Provider, { value: { value, onValueChange } }, children),
    SelectTrigger: ({ id }: { id?: string }) => {
      const ctx = React.useContext(Ctx);
      return React.createElement("select", {
        id,
        "data-testid": id,
        value: ctx.value ?? "",
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          ctx.onValueChange?.(event.target.value),
      }, React.createElement("option", { value: "" }, "-"),
        ...["2025", "2026", "2027", "2028", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(
          (option) => React.createElement("option", { key: option, value: option }, option)
        ));
    },
    SelectValue: () => null,
    SelectContent: () => null,
    SelectItem: () => null,
  };
});

import { RegisterMonthlyPaymentDialog } from "./register-monthly-payment-dialog";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render(props: { suspended?: boolean } = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <RegisterMonthlyPaymentDialog
        studentDisciplineId={ENROLLMENT_ID}
        branchId={BRANCH_ID}
        open
        onOpenChange={vi.fn()}
        hideTrigger
        {...props}
      />
    );
  });
}

function sheet(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-slot="sheet-content"]')!;
}

function setNative(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(input);
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(id: string, value: string) {
  const select = sheet().querySelector<HTMLSelectElement>(`#${id}`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** One month of coverage: November of the current year. */
function fillForm() {
  const amount = sheet().querySelector<HTMLInputElement>("#pay-amount")!;
  act(() => setNative(amount, "40"));
  choose("pay-first-month", "11");
  choose("pay-last-month", "11");
}

async function submit() {
  const form = sheet().querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.registerMonthlyPayment.mockResolvedValue({
    success: true,
    data: { id: "p1", next_due_date: "2026-12-05" },
  });
  mocks.reactivateEnrollment.mockResolvedValue({
    success: true,
    data: { id: ENROLLMENT_ID },
  });
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
  document.body.innerHTML = "";
});

const NEXT_DUE = PAYMENT_FOLLOW_UP_MESSAGES.NEXT_DUE(
  formatDate(parseDateOnly("2026-12-05"))
);

describe("RegisterMonthlyPaymentDialog follow-up", () => {
  it("names the new due date after a payment on an active enrollment", async () => {
    render();
    fillForm();
    await submit();

    expect(mocks.registerMonthlyPayment).toHaveBeenCalledTimes(1);
    expect(mocks.reactivateEnrollment).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      PAYMENT_FOLLOW_UP_MESSAGES.PAID,
      { description: NEXT_DUE }
    );
  });

  it("offers to pay and reactivate when the enrollment is suspended", () => {
    render({ suspended: true });

    const submitButton = sheet().querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );
    expect(submitButton?.textContent).toBe(
      PAYMENT_FOLLOW_UP_MESSAGES.PAY_AND_REACTIVATE
    );
  });

  it("reactivates the suspended enrollment after the payment is saved", async () => {
    render({ suspended: true });
    fillForm();
    await submit();

    expect(mocks.registerMonthlyPayment).toHaveBeenCalledTimes(1);
    expect(mocks.reactivateEnrollment).toHaveBeenCalledWith({
      student_discipline_id: ENROLLMENT_ID,
      branch_id: BRANCH_ID,
    });
    // Payment first, then the reactivation — never the other way around.
    expect(
      mocks.registerMonthlyPayment.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.reactivateEnrollment.mock.invocationCallOrder[0]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      PAYMENT_FOLLOW_UP_MESSAGES.PAID_AND_REACTIVATED,
      { description: NEXT_DUE }
    );
  });

  it("reports a saved payment as such when the reactivation fails", async () => {
    mocks.reactivateEnrollment.mockResolvedValue({
      success: false,
      error: "No autorizado",
    });
    render({ suspended: true });
    fillForm();
    await submit();

    expect(mocks.toastWarning).toHaveBeenCalledWith(
      PAYMENT_FOLLOW_UP_MESSAGES.PAID_NOT_REACTIVATED,
      { description: "No autorizado" }
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    // The form must not stay open inviting a second charge.
    expect(sheet().textContent).not.toContain("No autorizado");
  });

  it("never reactivates when the payment itself is rejected", async () => {
    mocks.registerMonthlyPayment.mockResolvedValue({
      success: false,
      error: PAYMENT_MESSAGES.PERIOD_OVERLAP,
    });
    render({ suspended: true });
    fillForm();
    await submit();

    expect(mocks.reactivateEnrollment).not.toHaveBeenCalled();
    expect(sheet().textContent).toContain(PAYMENT_MESSAGES.PERIOD_OVERLAP);
  });
});
