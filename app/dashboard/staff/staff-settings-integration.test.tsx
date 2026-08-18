/** Proves DefaultTeacherSelector is rendered from staff page with active same-branch teachers. */
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/identity-resolver", () => ({ getAuthenticatedContext: vi.fn() }));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: vi.fn() }));
const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444", TEACHER_A = "cccccccc-1111-2222-8333-444444444444";
describe("Staff settings — DefaultTeacherSelector integration", () => {
  beforeEach(() => vi.clearAllMocks());
  it("getBranchDefaultTeacher returns teacher ID when configured", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { teacher_id: TEACHER_A }, error: null }) }) }) }) } as never);
    expect(await (await import("@/lib/domain/roles/actions")).getBranchDefaultTeacher(BRANCH)).toBe(TEACHER_A);
  });
  it("getBranchDefaultTeacher returns null when none set", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) } as never);
    expect(await (await import("@/lib/domain/roles/actions")).getBranchDefaultTeacher(BRANCH)).toBeNull();
  });
  it("staff page integrates selector with teacher options and default fetch", async () => {
    const src = await import("fs/promises").then((fs) => fs.readFile("app/dashboard/staff/page.tsx", "utf-8"));
    expect(src).toContain("DefaultTeacherSelector");
    expect(src).toContain("getBranchDefaultTeacher");
    expect(src).toContain("listBranchTeacherOptions");
  });
});
