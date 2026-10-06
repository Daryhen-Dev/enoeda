// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ENROLLMENT_MESSAGES,
  PROGRESS_MESSAGES,
  STUDENT_DETAIL_MESSAGES,
} from "@/lib/localization/es-ec";

const mocks = vi.hoisted(() => ({
  suspendEnrollment: vi.fn(),
  reactivateEnrollment: vi.fn(),
  getPromotionReadiness: vi.fn(),
  promoteStudent: vi.fn(),
  reverseLatestPromotion: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/disciplines/actions", () => ({
  suspendEnrollment: mocks.suspendEnrollment,
  reactivateEnrollment: mocks.reactivateEnrollment,
}));
vi.mock("@/lib/domain/progress/actions", () => ({
  getPromotionReadiness: mocks.getPromotionReadiness,
  promoteStudent: mocks.promoteStudent,
  reverseLatestPromotion: mocks.reverseLatestPromotion,
}));
vi.mock("@/lib/domain/payments/actions", () => ({
  registerMonthlyPayment: vi.fn(),
  registerClassPayment: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { StudentDisciplineCard } from "./student-discipline-card";

const STUDENT_ID = "cccccccc-1111-2222-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const ENROLLMENT_ID = "dddddddd-1111-2222-8333-444444444444";
const DISCIPLINE_ID = "eeeeeeee-1111-2222-8333-444444444444";
const DISCIPLINE_NAME = "Karate";

const ACTIVE_ENROLLMENT = {
  id: ENROLLMENT_ID,
  discipline_id: DISCIPLINE_ID,
  discipline_name: DISCIPLINE_NAME,
  enrolled_at: new Date("2024-06-01T00:00:00.000Z"),
  is_active: true,
  suspended_at: null,
};

const LEVELS = [
  {
    id: "level-1",
    discipline_id: DISCIPLINE_ID,
    name: "Blanco",
    color: null,
    sort_order: 0,
    required_attended_sessions: 0,
  },
  {
    id: "level-2",
    discipline_id: DISCIPLINE_ID,
    name: "Amarillo",
    color: "#ff0",
    sort_order: 1,
    required_attended_sessions: 12,
  },
];

function baseProps() {
  return {
    enrollment: ACTIVE_ENROLLMENT,
    summary: null,
    attendance: null,
    paidThrough: null,
    levels: LEVELS,
    canManage: true,
    studentId: STUDENT_ID,
    branchId: BRANCH_ID,
  };
}

interface RenderedCard {
  container: HTMLDivElement;
  unmount(): void;
}

function renderCard(
  props: Partial<Parameters<typeof StudentDisciplineCard>[0]> = {}
): RenderedCard {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StudentDisciplineCard {...baseProps()} {...props} />);
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

function queryButtonByAriaLabel(container: HTMLElement, label: string) {
  return container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
}

describe("StudentDisciplineCard", () => {
  let rendered: RenderedCard | undefined;

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

  it("renders discipline-scoped accessible names for the management actions", () => {
    rendered = renderCard();

    const monthly = queryButtonByAriaLabel(
      rendered.container,
      STUDENT_DETAIL_MESSAGES.MONTHLY_PAYMENT_ARIA(DISCIPLINE_NAME)
    );
    const classPayment = queryButtonByAriaLabel(
      rendered.container,
      STUDENT_DETAIL_MESSAGES.CLASS_PAYMENT_ARIA(DISCIPLINE_NAME)
    );
    const promote = queryButtonByAriaLabel(
      rendered.container,
      STUDENT_DETAIL_MESSAGES.PROMOTE_ARIA(DISCIPLINE_NAME)
    );

    expect(monthly).not.toBeNull();
    expect(monthly?.textContent).toContain("Registrar pago mensual");
    expect(classPayment).not.toBeNull();
    expect(classPayment?.textContent).toContain("Cobrar clase");
    expect(promote).not.toBeNull();
    expect(promote?.textContent).toContain(PROGRESS_MESSAGES.PROMOTE_ACTION);
  });

  it("renders no management actions when canManage is false", () => {
    rendered = renderCard({ canManage: false });

    expect(
      queryButtonByAriaLabel(
        rendered.container,
        STUDENT_DETAIL_MESSAGES.MONTHLY_PAYMENT_ARIA(DISCIPLINE_NAME)
      )
    ).toBeNull();
    expect(
      queryButtonByAriaLabel(
        rendered.container,
        STUDENT_DETAIL_MESSAGES.CLASS_PAYMENT_ARIA(DISCIPLINE_NAME)
      )
    ).toBeNull();
    expect(rendered.container.textContent).not.toContain(
      "Registrar pago mensual"
    );
    expect(rendered.container.textContent).not.toContain(
      ENROLLMENT_MESSAGES.REACTIVATE_ACTION
    );
  });

  it("shows the suspended status and only the reactivate action", () => {
    rendered = renderCard({
      enrollment: { ...ACTIVE_ENROLLMENT, is_active: false },
      canManage: true,
    });

    expect(rendered.container.textContent).toContain(
      ENROLLMENT_MESSAGES.SUSPENDED_LABEL
    );
    expect(
      queryButtonByAriaLabel(
        rendered.container,
        STUDENT_DETAIL_MESSAGES.MONTHLY_PAYMENT_ARIA(DISCIPLINE_NAME)
      )
    ).toBeNull();
    expect(
      queryButtonByAriaLabel(
        rendered.container,
        STUDENT_DETAIL_MESSAGES.CLASS_PAYMENT_ARIA(DISCIPLINE_NAME)
      )
    ).toBeNull();
    expect(
      queryButtonByAriaLabel(
        rendered.container,
        STUDENT_DETAIL_MESSAGES.PROMOTE_ARIA(DISCIPLINE_NAME)
      )
    ).toBeNull();
    expect(rendered.container.textContent).toContain(
      ENROLLMENT_MESSAGES.REACTIVATE_ACTION
    );
  });
});
