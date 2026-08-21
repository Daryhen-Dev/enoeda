/**
 * getSessionsForRange — effective teacher resolver integration.
 * Verifies $queryRaw call to resolve_effective_teacher per occurrence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const mockQueryRaw = vi.fn();
const mockFindMany = vi.fn();
const mockAdminQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  in: vi.fn(),
};
mockAdminQuery.select.mockReturnValue(mockAdminQuery);
mockAdminQuery.eq.mockReturnValue(mockAdminQuery);
mockAdminQuery.is.mockReturnValue(mockAdminQuery);
mockAdminQuery.in.mockResolvedValue({ data: [], error: null });
const mockTx = {
  scheduled_classes: { findMany: mockFindMany },
  class_sessions: { findMany: vi.fn().mockResolvedValue([]) },
  one_time_classes: { findMany: vi.fn().mockResolvedValue([]) },
  attendance: { findMany: vi.fn().mockResolvedValue([]) },
  $queryRaw: mockQueryRaw,
};
const mockWithAuth = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => mockAdminQuery }),
}));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: (...a: unknown[]) => mockWithAuth(...a) }));
vi.mock("@/lib/auth/assert-branch-assignment", () => ({ assertActiveBranchAssignment: () => ({ ok: true }) }));

import { getSessionsForRange } from "./actions";

const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const CLASS = "11111111-2222-3333-8444-555555555555";
const T_A = "aaaa1111-2222-3333-8444-555555555555";
const T_B = "bbbb1111-2222-3333-8444-555555555555";

function setupAuth() {
  mockWithAuth.mockImplementation(async (fn: (tx: typeof mockTx, ctx: {
    userId: string;
    roles: string[];
    assignments: Array<{ role: string; branchId: string }>;
  }) => Promise<unknown>) => {
    const ctx = { userId: "u1", roles: ["admin"], assignments: [{ role: "admin", branchId: BRANCH }] };
    return { success: true, data: await fn(mockTx, ctx) };
  });
}

function makeClass(teacherId: string) {
  return { id: CLASS, day_of_week: 0, start_time: new Date("1970-01-01T08:00:00Z"), default_teacher_id: teacherId, disciplines: { id: "d1", name: "Yoga", code: "YG" } };
}

describe("getSessionsForRange resolver integration", () => {
  beforeEach(() => { vi.clearAllMocks(); mockTx.class_sessions.findMany.mockResolvedValue([]); mockTx.one_time_classes.findMany.mockResolvedValue([]); });

  it("calls $queryRaw and uses resolved teacher instead of default_teacher_id", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A)]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: T_B }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(r.data![0].teacher_id).toBe(T_B);
  });

  it("falls back to default_teacher_id when resolver returns null", async () => {
    mockFindMany.mockResolvedValue([makeClass(T_A)]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: null }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(r.data![0].teacher_id).toBe(T_A);
  });

  it("preserves override teacher from class_sessions", async () => {
    const T_OVR = "cccc1111-2222-3333-8444-555555555555";
    mockFindMany.mockResolvedValue([makeClass(T_A)]);
    mockQueryRaw.mockResolvedValue([{ class_id: CLASS, session_date: "2026-09-07", resolve_effective_teacher: T_OVR }]);
    mockTx.class_sessions.findMany.mockResolvedValue([{ scheduled_class_id: CLASS, session_date: new Date("2026-09-07"), status: "scheduled", suspension_category: null, suspension_reason: null, assigned_teacher_id: T_OVR }]);
    setupAuth();
    const r = await getSessionsForRange({ branch_id: BRANCH, start_date: "2026-09-07", end_date: "2026-09-07" });
    expect(r.success).toBe(true);
    expect(r.data![0].teacher_id).toBe(T_OVR);
  });
});
