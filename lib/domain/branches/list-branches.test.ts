import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWithAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/server-context", () => ({
  withAuthenticatedUser: (...args: unknown[]) => mockWithAuthenticatedUser(...args),
}));

import { listBranches } from "./actions";

const BRANCH = {
  id: "aaaaaaaa-1111-4222-a333-444444444444",
  name: "Matriz",
  address: null,
  phone: null,
  time_zone: "America/Guayaquil",
  is_active: true,
};

function withFindMany(rows: unknown[]) {
  const findMany = vi.fn(async () => rows);
  mockWithAuthenticatedUser.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => ({
      success: true,
      data: await fn({ branches: { findMany } }),
    })
  );
  return findMany;
}

describe("listBranches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches active and inactive branches in a single query for status all", async () => {
    const findMany = withFindMany([BRANCH, { ...BRANCH, is_active: false }]);

    const result = await listBranches({ status: "all" });

    expect(mockWithAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ is_active: "desc" }, { name: "asc" }],
      })
    );
    expect(result).toEqual({
      success: true,
      data: [BRANCH, { ...BRANCH, is_active: false }],
    });
  });

  it("keeps filtering by is_active for single-status lists", async () => {
    const findMany = withFindMany([BRANCH]);

    await listBranches({ status: "inactive" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: false } })
    );
  });

  it("defaults to active branches", async () => {
    const findMany = withFindMany([BRANCH]);

    await listBranches();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: true } })
    );
  });

  it("propagates a transaction failure instead of returning an empty list", async () => {
    mockWithAuthenticatedUser.mockResolvedValue({
      success: false,
      error: "unexpected",
    });

    const result = await listBranches({ status: "all" });

    expect(result).toEqual({ success: false, error: "unexpected" });
  });

  it("rejects unknown status values", async () => {
    const result = await listBranches({ status: "deleted" });

    expect(result.success).toBe(false);
    expect(mockWithAuthenticatedUser).not.toHaveBeenCalled();
  });
});
