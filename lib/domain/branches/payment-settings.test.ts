import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

import { saveBranchPaymentSettings } from "./actions";

const BRANCH_ID = "aaaaaaaa-1111-4222-a333-444444444444";

const branchAdminContext = {
  userId: "admin-1",
  roles: ["admin" as const],
  assignments: [{ role: "admin" as const, branchId: BRANCH_ID }],
};

function authenticatedWith(context: unknown, tx: unknown) {
  mockWithAuthenticatedUser.mockImplementation(async (fn: (tx: unknown, ctx: unknown) => Promise<unknown>) => ({
    success: true,
    data: await fn(tx, context),
  }));
}

describe("branch payment settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid due-day and correction-window values before authentication", async () => {
    const invalidDueDay = await saveBranchPaymentSettings({
      branch_id: BRANCH_ID,
      payment_due_day: 0,
      payment_edit_window_days: 7,
    });
    const invalidWindow = await saveBranchPaymentSettings({
      branch_id: BRANCH_ID,
      payment_due_day: 5,
      payment_edit_window_days: -1,
    });

    expect(invalidDueDay.success).toBe(false);
    expect(invalidWindow.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "teacher",
      context: {
        userId: "teacher-1",
        roles: ["teacher" as const],
        assignments: [{ role: "teacher" as const, branchId: BRANCH_ID }],
      },
    },
    {
      name: "owner",
      context: {
        userId: "owner-1",
        roles: ["owner" as const],
        assignments: [{ role: "owner" as const, branchId: null }],
      },
    },
  ])("denies a $name without a branch-admin assignment", async ({ context }) => {
    const queryRaw = vi.fn();
    authenticatedWith(context, { $queryRaw: queryRaw });

    const result = await saveBranchPaymentSettings({
      branch_id: BRANCH_ID,
      payment_due_day: 5,
      payment_edit_window_days: 7,
    });

    expect(result.success).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("saves active branch settings and returns the persisted data", async () => {
    const settings = {
      branch_id: BRANCH_ID,
      payment_due_day: 5,
      payment_edit_window_days: 7,
    };
    const queryRaw = vi.fn().mockResolvedValue([settings]);
    authenticatedWith(branchAdminContext, { $queryRaw: queryRaw });

    const result = await saveBranchPaymentSettings(settings);

    expect(result).toEqual({ success: true, data: settings });
    const sql = (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("");
    expect(sql).toContain("WHERE id = ");
    expect(sql).toContain("AND is_active = true");
  });
});
