/**
 * DashboardOverview — S2 contract.
 *
 * A teacher-only user keeps the "Hoy" overview (agenda + quick access to
 * conducta and estudiantes) instead of being redirected to the calendar, while
 * an admin keeps the payments action panel that used to live on this page.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthenticatedContext: vi.fn(),
  resolveBranchContext: vi.fn(),
  getSessionsForRange: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: mocks.getAuthenticatedContext,
}));

vi.mock("@/lib/auth/branch-context", () => ({
  resolveBranchContext: mocks.resolveBranchContext,
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  getSessionsForRange: mocks.getSessionsForRange,
}));

vi.mock("@/components/dashboard/today-agenda-panel", () => ({
  TodayAgendaPanel: () => <section data-testid="agenda-panel" />,
}));

vi.mock("@/components/dashboard/payments-action-panel", () => ({
  PaymentsActionPanelSection: async () => (
    <section data-testid="payments-panel" />
  ),
}));

import DashboardOverview from "./page";

function identity(roles: string[]) {
  return { ok: true, ctx: { userId: "u_1", roles, assignments: [] } };
}

function branchContext(canManage: boolean) {
  return {
    type: "ok" as const,
    branchId: BRANCH_ID,
    branchName: "Carapungo",
    timeZone: "America/Guayaquil" as const,
    canManage,
    canWriteConduct: true,
    isGlobalAdminReadOnly: false,
  };
}

async function renderOverview() {
  const element = await DashboardOverview({
    searchParams: Promise.resolve({ branch: BRANCH_ID }),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.getAuthenticatedContext.mockReset();
  mocks.resolveBranchContext.mockReset();
  mocks.getSessionsForRange.mockReset();
  mocks.getSessionsForRange.mockResolvedValue({ success: true, data: [] });
});

describe("DashboardOverview for a teacher-only user", () => {
  it("no longer sends the teacher away from the overview", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(identity(["teacher"]));
    mocks.resolveBranchContext.mockResolvedValue(branchContext(false));

    await renderOverview();

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("renders today's agenda so attendance is one tap away", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(identity(["teacher"]));
    mocks.resolveBranchContext.mockResolvedValue(branchContext(false));

    const html = await renderOverview();

    expect(html).toContain('data-testid="agenda-panel"');
  });

  it("offers quick access to conducta and the student search", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(identity(["teacher"]));
    mocks.resolveBranchContext.mockResolvedValue(branchContext(false));

    const html = await renderOverview();

    expect(html).toContain(`/dashboard/conduct?branch=${BRANCH_ID}`);
    expect(html).toContain(`/dashboard/students?branch=${BRANCH_ID}`);
  });

  it("keeps the payments action panel out of a teacher's overview", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(identity(["teacher"]));
    mocks.resolveBranchContext.mockResolvedValue(branchContext(false));

    const html = await renderOverview();

    // The payments column is the only thing that occupies this grid span, so
    // its absence proves the whole payments area (panel + Suspense boundary)
    // stays admin-only.
    expect(html).not.toContain("xl:col-span-5");
    expect(html).toContain("xl:col-span-12");
  });
});

describe("DashboardOverview for an admin", () => {
  it("still renders the payments action area it had before", async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(identity(["admin"]));
    mocks.resolveBranchContext.mockResolvedValue(branchContext(true));

    const html = await renderOverview();

    expect(html).toContain("xl:col-span-5");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
