// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec";
import type { ConductRecord, ConductSummary } from "@/lib/domain/conduct";

const mocks = vi.hoisted(() => ({
  markFinePaid: vi.fn(),
  voidConductRecord: vi.fn(),
  refresh: vi.fn(),
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
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { StudentConductPanel } from "./student-conduct-panel";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const BASE_RECORD: ConductRecord = {
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

const PENDING_FINE: ConductRecord = { ...BASE_RECORD };

const PAID_FINE: ConductRecord = {
  ...BASE_RECORD,
  id: "cccccccc-2222-2222-8333-444444444444",
  reason: "Perdió la llave",
  status: "paid",
  amount: 3,
  paid_at: new Date("2026-01-06T12:00:00.000Z"),
  paid_by: "eeeeeeee-1111-2222-8333-444444444444",
};

const WARNING: ConductRecord = {
  ...BASE_RECORD,
  id: "cccccccc-3333-2222-8333-444444444444",
  kind: "warning",
  reason: "Llegó tarde a clase",
  amount: null,
  status: "issued",
};

const VOIDED_WARNING: ConductRecord = {
  ...BASE_RECORD,
  id: "cccccccc-4444-2222-8333-444444444444",
  kind: "warning",
  reason: "Falta sin aviso",
  amount: null,
  status: "issued",
  voided_at: new Date("2026-01-07T09:00:00.000Z"),
  voided_by: "eeeeeeee-1111-2222-8333-444444444444",
  void_reason: "Fue un error de registro",
};

const ZERO_SUMMARY: ConductSummary = {
  pending_fines_count: 0,
  pending_fines_total: 0,
  warnings_count: 0,
};

function baseProps() {
  return {
    records: [PENDING_FINE, PAID_FINE, WARNING, VOIDED_WARNING],
    summary: {
      ...ZERO_SUMMARY,
      pending_fines_count: 1,
      pending_fines_total: 5,
      warnings_count: 2,
    },
    branchId: BRANCH_ID,
    canManage: true,
  };
}

interface RenderedPanel {
  container: HTMLDivElement;
  unmount(): void;
}

function renderPanel(
  props: Partial<Parameters<typeof StudentConductPanel>[0]> = {}
): RenderedPanel {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StudentConductPanel {...baseProps()} {...props} />);
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

function queryButtonsByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
    (button) => button.textContent?.includes(text)
  );
}

describe("StudentConductPanel", () => {
  let rendered: RenderedPanel | undefined;

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

  it("renders the summary with pending fine total and warning count", () => {
    rendered = renderPanel();

    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.PANEL_TITLE
    );
    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(1, formatCurrency(5))
    );
    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.SUMMARY_WARNINGS(2)
    );
  });

  it("renders kind badges, fine status and amounts without relying on color alone", () => {
    rendered = renderPanel({ records: [PENDING_FINE, PAID_FINE] });

    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.KIND_FINE
    );
    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.STATUS_PENDING
    );
    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.STATUS_PAID
    );
    expect(rendered.container.textContent).toContain(formatCurrency(5));
    expect(rendered.container.textContent).toContain(formatCurrency(3));
  });

  it("renders warnings with their own badge label", () => {
    rendered = renderPanel({ records: [WARNING] });

    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.KIND_WARNING
    );
    expect(rendered.container.textContent).toContain(
      "Llegó tarde a clase"
    );
  });

  it("renders voided records muted with the void reason", () => {
    rendered = renderPanel({ records: [VOIDED_WARNING] });

    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.VOIDED_BADGE
    );
    expect(rendered.container.textContent).toContain(
      VOIDED_WARNING.void_reason
    );
    const voidedCard = rendered.container.querySelector("article.bg-muted\\/40");
    expect(voidedCard).not.toBeNull();
  });

  it("renders the empty state when there are no records", () => {
    rendered = renderPanel({ records: [], summary: ZERO_SUMMARY });

    expect(rendered.container.textContent).toContain(
      CONDUCT_MESSAGES.EMPTY_STATE
    );
  });

  it("renders no row actions when canManage is false", () => {
    rendered = renderPanel({ canManage: false });

    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.MARK_PAID_ACTION)
    ).toHaveLength(0);
    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.VOID_ACTION)
    ).toHaveLength(0);
  });

  it("renders row actions only for actionable records when canManage is true", () => {
    rendered = renderPanel();

    // Only the pending fine can be marked as paid.
    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.MARK_PAID_ACTION)
    ).toHaveLength(1);
    // The pending fine and the warning can be voided; the paid fine cannot.
    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.VOID_ACTION)
    ).toHaveLength(2);
  });

  it("renders no row actions for voided records", () => {
    rendered = renderPanel({ records: [VOIDED_WARNING] });

    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.MARK_PAID_ACTION)
    ).toHaveLength(0);
    expect(
      queryButtonsByText(rendered.container, CONDUCT_MESSAGES.VOID_ACTION)
    ).toHaveLength(0);
  });
});
