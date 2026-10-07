// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_VALIDATION_MESSAGES } from "@/lib/localization/es-ec";
import type { MonthlyPaymentValidationResult } from "@/lib/domain/payments/validation-actions";

const mocks = vi.hoisted(() => ({
  getMonthlyPaymentValidation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/domain/payments/validation-actions", () => ({
  getMonthlyPaymentValidation: mocks.getMonthlyPaymentValidation,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import MonthlyPaymentValidationSection from "./monthly-payment-validation-section";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const TIME_ZONE = "America/Guayaquil";

function row(index: number, daysOverdue: number) {
  return {
    student_discipline_id: `dddddddd-000${index}-2222-8333-444444444444`,
    student_id: `cccccccc-000${index}-2222-8333-444444444444`,
    student_name: `Estudiante ${index}`,
    discipline_name: "Karate",
    next_due_date: "2026-09-01",
    days_overdue: daysOverdue,
    grace_deadline: "2026-09-04",
  };
}

const VALIDATION_RESULT: MonthlyPaymentValidationResult = {
  today: "2026-09-15",
  month: "2026-09",
  grace_days: 3,
  up_to_date: [row(1, 0)],
  in_grace: [row(2, 2)],
  to_suspend: [row(3, 10), row(4, 9), row(5, 8)],
  suspended_this_month: [
    {
      student_discipline_id: "dddddddd-0006-2222-8333-444444444444",
      student_id: "cccccccc-0006-2222-8333-444444444444",
      student_name: "Estudiante 6",
      discipline_name: "Yoga",
      suspended_at: "2026-09-10T15:00:00.000Z",
      performed_by_name: null,
      currently_suspended: true,
    },
  ],
};

interface RenderedSection {
  container: HTMLDivElement;
  unmount(): void;
}

/**
 * The section is an async server component; jsdom + createRoot cannot render
 * async children, so the test awaits the component function (plain async
 * function returning elements) and renders the resulting element tree.
 */
async function renderSection(headingLevel: "h1" | "h2"): Promise<RenderedSection> {
  const element = await MonthlyPaymentValidationSection({
    branchId: BRANCH_ID,
    timeZone: TIME_ZONE,
    headingLevel,
  });

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
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

describe("MonthlyPaymentValidationSection", () => {
  let rendered: RenderedSection | undefined;

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

  it("renders an inline destructive alert without throwing when the load fails", async () => {
    mocks.getMonthlyPaymentValidation.mockResolvedValue({
      success: false,
      error: "Base de datos no disponible.",
    });

    rendered = await renderSection("h1");

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE
    );
    expect(alert?.textContent).toContain("Base de datos no disponible.");
    // No section body: the host page keeps rendering around the alert.
    expect(document.getElementById("monthly-payment-validation-heading")).toBeNull();
  });

  it("falls back to the service-unavailable copy when the error is empty", async () => {
    mocks.getMonthlyPaymentValidation.mockResolvedValue({
      success: false,
      error: "",
    });

    rendered = await renderSection("h1");

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE
    );
  });

  it("renders the heading, four metric counts and four section titles on success", async () => {
    mocks.getMonthlyPaymentValidation.mockResolvedValue({
      success: true,
      data: VALIDATION_RESULT,
    });

    rendered = await renderSection("h2");

    // Heading outline: the host page decides h1 vs h2.
    const heading = document.getElementById(
      "monthly-payment-validation-heading"
    );
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe(
      PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE
    );
    const section = rendered.container.querySelector(
      `section[aria-labelledby="monthly-payment-validation-heading"]`
    );
    expect(section).not.toBeNull();

    // Metric cards: labels and counts from the loaded result.
    const metrics = rendered.container.querySelector(
      `section[aria-label="${PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}"]`
    );
    expect(metrics?.textContent).toContain(PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE);
    expect(metrics?.textContent).toContain("1");
    expect(metrics?.textContent).toContain(PAYMENT_VALIDATION_MESSAGES.IN_GRACE);
    expect(metrics?.textContent).toContain(PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND);
    expect(metrics?.textContent).toContain("3");
    expect(metrics?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SUSPENDED_THIS_MONTH
    );

    // Section cards: each group rendered once as a card title. Scoped to
    // direct-card children of the section, excluding the metric cards.
    const cardTitles = [
      ...rendered.container.querySelectorAll(
        'section[aria-labelledby="monthly-payment-validation-heading"] > [data-slot="card"] [data-slot="card-title"]'
      ),
    ].map((title) => title.textContent);
    for (const label of [
      PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND,
      PAYMENT_VALIDATION_MESSAGES.IN_GRACE,
      PAYMENT_VALIDATION_MESSAGES.SUSPENDED_THIS_MONTH,
      PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE,
    ]) {
      expect(cardTitles.filter((title) => title === label)).toHaveLength(1);
    }
  });

  it("renders an h1 heading when requested", async () => {
    mocks.getMonthlyPaymentValidation.mockResolvedValue({
      success: true,
      data: VALIDATION_RESULT,
    });

    rendered = await renderSection("h1");

    expect(
      document.getElementById("monthly-payment-validation-heading")?.tagName
    ).toBe("H1");
  });

  it("passes the branch id to the loading action", async () => {
    mocks.getMonthlyPaymentValidation.mockResolvedValue({
      success: true,
      data: VALIDATION_RESULT,
    });

    rendered = await renderSection("h2");

    expect(mocks.getMonthlyPaymentValidation).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
    });
  });
});
