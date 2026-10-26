// @vitest-environment jsdom

/**
 * RegisterMonthlyPaymentDialog — the period the form charges and what happens
 * after the payment is saved.
 *
 * The form opens in easy mode: amount, one month and the payment date. The
 * start/end month range of the advanced mode still exists, but only behind an
 * explicit switch, and it carries the selected month over in both directions.
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
 * settles), the same limitation the dropdown menu hit. This test is about the
 * period and about what happens AFTER the submit, so the month and year
 * pickers become a native <select> that forwards the same value contract and
 * the invalid styling hook.
 */
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  type Props = { value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode };
  const Ctx = React.createContext<Props>({});
  return {
    Select: ({ value, onValueChange, children }: Props) =>
      React.createElement(Ctx.Provider, { value: { value, onValueChange } }, children),
    SelectTrigger: ({
      id,
      "aria-invalid": ariaInvalid,
    }: {
      id?: string;
      "aria-invalid"?: boolean | "true" | "false";
    }) => {
      const ctx = React.useContext(Ctx);
      return React.createElement("select", {
        id,
        "data-testid": id,
        "aria-invalid": ariaInvalid ? "true" : undefined,
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

function render(
  props: { suspended?: boolean; suggestedMonth?: string } = {}
) {
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

function querySelect(id: string) {
  return sheet().querySelector<HTMLSelectElement>(`#${id}`);
}

function choose(id: string, value: string) {
  const select = querySelect(id)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickButtonByText(text: string) {
  const button = [...sheet().querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === text
  );
  expect(button).toBeDefined();
  act(() => {
    button!.click();
  });
}

/** Only the amount; the period comes from the mode defaults. */
function fillAmount(value = "40") {
  const amount = sheet().querySelector<HTMLInputElement>("#pay-amount")!;
  act(() => setNative(amount, value));
}

async function submit() {
  const form = sheet().querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
}

function lastPayload() {
  const calls = mocks.registerMonthlyPayment.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

function invalidFields() {
  return sheet().querySelectorAll('[aria-invalid="true"]');
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
    fillAmount();
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
    fillAmount();
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
    fillAmount();
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
    fillAmount();
    await submit();

    expect(mocks.reactivateEnrollment).not.toHaveBeenCalled();
    expect(sheet().textContent).toContain(PAYMENT_MESSAGES.PERIOD_OVERLAP);
  });
});

describe("RegisterMonthlyPaymentDialog period", () => {
  it("opens in easy mode and charges exactly the suggested month", async () => {
    render({ suggestedMonth: "2026-11" });

    // Easy mode: one month, so no start/end range fields at all.
    expect(querySelect("pay-first-month")).toBeNull();
    expect(querySelect("pay-last-month")).toBeNull();
    expect(querySelect("pay-start-year")).toBeNull();
    expect(querySelect("pay-end-year")).toBeNull();
    expect(querySelect("pay-month")!.value).toBe("11");
    expect(querySelect("pay-month-year")!.value).toBe("2026");
    expect(sheet().textContent).toContain(PAYMENT_MESSAGES.COVERAGE_MONTH_COUNT(1));

    fillAmount();
    await submit();

    expect(lastPayload()).toMatchObject({
      student_discipline_id: ENROLLMENT_ID,
      amount: 40,
      period_start: "2026-11-01",
      period_end: "2026-12-01",
    });
  });

  it("rolls December over to January of the next year", async () => {
    render({ suggestedMonth: "2026-12" });

    expect(querySelect("pay-month")!.value).toBe("12");
    fillAmount();
    await submit();

    expect(lastPayload()).toMatchObject({
      period_start: "2026-12-01",
      period_end: "2027-01-01",
    });
  });

  it("defaults to the current month when no month is suggested", async () => {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const expectedEnd = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}-01`;

    render();

    expect(querySelect("pay-month")!.value).toBe(currentMonth);
    fillAmount();
    await submit();

    expect(lastPayload()).toMatchObject({
      period_start: `${now.getFullYear()}-${currentMonth}-01`,
      period_end: expectedEnd,
    });
  });

  it("switches to the advanced range and charges the chosen range", async () => {
    render({ suggestedMonth: "2026-11" });

    clickButtonByText(PAYMENT_MESSAGES.PAY_MULTIPLE_MONTHS_ACTION);

    // Switching is not a submit, and the month carries over as first and last.
    expect(mocks.registerMonthlyPayment).not.toHaveBeenCalled();
    expect(querySelect("pay-month")).toBeNull();
    expect(querySelect("pay-start-year")!.value).toBe("2026");
    expect(querySelect("pay-first-month")!.value).toBe("11");
    expect(querySelect("pay-end-year")!.value).toBe("2026");
    expect(querySelect("pay-last-month")!.value).toBe("11");

    choose("pay-end-year", "2027");
    choose("pay-last-month", "01");
    expect(sheet().textContent).toContain(PAYMENT_MESSAGES.COVERAGE_MONTH_COUNT(3));

    fillAmount();
    await submit();

    expect(lastPayload()).toMatchObject({
      period_start: "2026-11-01",
      period_end: "2027-02-01",
    });
  });

  it("returns to easy mode and charges a single month again", async () => {
    render({ suggestedMonth: "2026-11" });

    clickButtonByText(PAYMENT_MESSAGES.PAY_MULTIPLE_MONTHS_ACTION);
    choose("pay-first-month", "03");
    clickButtonByText(PAYMENT_MESSAGES.PAY_SINGLE_MONTH_ACTION);

    expect(querySelect("pay-first-month")).toBeNull();
    expect(querySelect("pay-last-month")).toBeNull();
    // The advanced first month becomes the single month to pay.
    expect(querySelect("pay-month")!.value).toBe("03");

    fillAmount();
    await submit();

    expect(lastPayload()).toMatchObject({
      period_start: "2026-03-01",
      period_end: "2026-04-01",
    });
  });

  it("enables the submit in easy mode as soon as there is an amount", () => {
    render({ suggestedMonth: "2026-11" });
    const submitButton = () =>
      sheet().querySelector<HTMLButtonElement>('button[type="submit"]')!;

    // The month is already chosen, so only the amount is missing.
    expect(submitButton().disabled).toBe(true);

    fillAmount();

    expect(submitButton().disabled).toBe(false);
  });

  it("shows no invalid styling on a freshly opened form in either mode", () => {
    render({ suggestedMonth: "2026-11" });

    expect(invalidFields()).toHaveLength(0);

    clickButtonByText(PAYMENT_MESSAGES.PAY_MULTIPLE_MONTHS_ACTION);

    expect(invalidFields()).toHaveLength(0);
    expect(sheet().textContent).not.toContain(
      PAYMENT_MESSAGES.MONTH_RANGE_INVALID
    );
  });

  it("flags an impossible range only after the user changes it", async () => {
    render({ suggestedMonth: "2026-11" });
    clickButtonByText(PAYMENT_MESSAGES.PAY_MULTIPLE_MONTHS_ACTION);

    // Start December of 2026 while the end stays November of 2026.
    choose("pay-first-month", "12");

    expect(invalidFields().length).toBeGreaterThan(0);
    expect(sheet().textContent).toContain(PAYMENT_MESSAGES.MONTH_RANGE_INVALID);

    fillAmount();
    await submit();

    expect(mocks.registerMonthlyPayment).not.toHaveBeenCalled();
  });
});
