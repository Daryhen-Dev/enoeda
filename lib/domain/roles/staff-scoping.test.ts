/**
 * Staff list branch scoping tests.
 *
 * Verifies that listBranchStaff filters by branch_id in the query
 * (not after fetching), as required by the security spec.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("server-only", () => ({}));

// Mock identity resolver (listBranchStaff doesn't use it, but other exports do)
vi.mock("@/lib/auth/identity-resolver", () => ({
  getAuthenticatedContext: vi.fn().mockResolvedValue({
    ok: true,
    ctx: {
      userId: "admin-1",
      roles: ["admin"],
      assignments: [{ role: "admin", branchId: "branch-1" }],
    },
  }),
}));

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: vi.fn().mockImplementation(async (fn: Function) => ({
    success: true,
    data: [],
  })),
}));

import { listBranchStaff } from "@/lib/domain/roles/actions";

describe("listBranchStaff — branch scoping", () => {
  let mockQuery: ReturnType<typeof createMockQuery>;

  function createMockQuery() {
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    // order() is the terminal call, awaited — returns a thenable with data/error
    chain.order = vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null }));
    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = createMockQuery();
    mockCreateClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(mockQuery),
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });
  });

  it("includes branch_id eq filter in query when branchId is provided", async () => {
    await listBranchStaff({ branchId: "branch-xyz" });

    expect(mockQuery.eq).toHaveBeenCalledWith("branch_id", "branch-xyz");
  });

  it("does not include branch_id eq filter when no branchId provided", async () => {
    await listBranchStaff();

    expect(mockQuery.eq).not.toHaveBeenCalled();
  });
});
