// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  CONDUCT_QUICK_ENTRY_MESSAGES,
  formatDate,
  formatCurrency,
} from "@/lib/localization/es-ec";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/domain/conduct", () => ({
  CONDUCT_KINDS: { FINE: "fine", WARNING: "warning" },
  CONDUCT_STATUSES: { PENDING: "pending", PAID: "paid", ISSUED: "issued" },
}));

import {
  RecentConductRecords,
  type RecentConductRecordView,
} from "./recent-conduct-records";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const STUDENT_ID = "22222222-3333-4444-8555-666666666661";

function buildRecord(overrides: Partial<RecentConductRecordView> = {}): RecentConductRecordView {
  return {
    id: "record-1",
    student_id: STUDENT_ID,
    student: {
      id: STUDENT_ID,
      first_name: "Ana",
      surname: "Zapata",
    },
    kind: "fine",
    reason: "Llegó tarde repetidamente",
    incident_date: new Date("2026-09-20T00:00:00.000Z"),
    amount: 5,
    status: "pending",
    paid_at: null,
    paid_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_by: "user-1",
    created_at: new Date("2026-09-21T12:00:00.000Z"),
    updated_at: new Date("2026-09-21T12:00:00.000Z"),
    ...overrides,
  };
}

interface RenderedList {
  unmount(): void;
}

function renderList(
  records: RecentConductRecordView[],
  initialError?: string
): RenderedList {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <RecentConductRecords
        records={records}
        branchId={BRANCH_ID}
        initialError={initialError}
      />
    );
  });

  return {
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("RecentConductRecords", () => {
  let rendered: RenderedList | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
  });

  it("renders a pending fine with student link, kind badge, amount, status and date", () => {
    rendered = renderList([buildRecord()]);

    const link = document.querySelector<HTMLAnchorElement>(
      `a[href="/dashboard/students/${STUDENT_ID}?branch=${BRANCH_ID}"]`
    );
    expect(link?.textContent).toContain("Zapata Ana");
    expect(document.body.textContent).toContain(CONDUCT_MESSAGES.KIND_FINE);
    expect(document.body.textContent).toContain(
      `${CONDUCT_MESSAGES.AMOUNT_LABEL}: ${formatCurrency(5)}`
    );
    expect(document.body.textContent).toContain(
      CONDUCT_MESSAGES.STATUS_PENDING
    );
    expect(document.body.textContent).toContain(
      formatDate(new Date("2026-09-20T00:00:00.000Z"))
    );
    expect(document.body.textContent).toContain(
      "Llegó tarde repetidamente"
    );
  });

  it("renders a paid fine and a warning with their own badges", () => {
    rendered = renderList([
      buildRecord({ id: "record-2", status: "paid" }),
      buildRecord({
        id: "record-3",
        kind: "warning",
        amount: null,
        status: "issued",
        reason: "Interrumpió la clase",
      }),
    ]);

    expect(document.body.textContent).toContain(CONDUCT_MESSAGES.STATUS_PAID);
    expect(document.body.textContent).toContain(
      CONDUCT_MESSAGES.KIND_WARNING
    );
    expect(document.body.textContent).toContain("Interrumpió la clase");
  });

  it("renders a voided record with the Anulado badge instead of the fine status", () => {
    rendered = renderList([
      buildRecord({
        voided_at: new Date("2026-09-22T12:00:00.000Z"),
        voided_by: "user-2",
        void_reason: "Registrado por error",
      }),
    ]);

    expect(document.body.textContent).toContain(
      CONDUCT_MESSAGES.VOIDED_BADGE
    );
    expect(document.body.textContent).toContain(
      CONDUCT_MESSAGES.VOIDED_WITH_REASON("Registrado por error")
    );
    expect(document.body.textContent).not.toContain(
      CONDUCT_MESSAGES.STATUS_PENDING
    );
  });

  it("renders the empty state when there are no records", () => {
    rendered = renderList([]);

    expect(document.body.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_EMPTY
    );
  });

  it("renders the load failure message when the initial load failed", () => {
    rendered = renderList([], CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_LOAD_FAILURE);

    expect(document.body.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_LOAD_FAILURE
    );
  });
});
