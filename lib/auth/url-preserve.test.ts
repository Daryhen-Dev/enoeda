/**
 * URL Preservation Tests — Correction F.
 *
 * Ensures branch redirect URLs preserve all non-branch query params.
 */
import { describe, it, expect } from "vitest";

import { buildBranchRedirectUrl, extractNonBranchParams } from "./url-preserve";

const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("buildBranchRedirectUrl", () => {
  it("preserves existing non-branch query params", () => {
    const params = { tab: "active", page: "2", branch: "old-id" };
    const url = buildBranchRedirectUrl("/dashboard/staff", params, BRANCH_ID);

    expect(url).toContain("tab=active");
    expect(url).toContain("page=2");
    expect(url).toContain(`branch=${BRANCH_ID}`);
    expect(url).not.toContain("old-id");
  });

  it("works with no extra params", () => {
    const url = buildBranchRedirectUrl("/dashboard/staff", {}, BRANCH_ID);
    expect(url).toBe(`/dashboard/staff?branch=${BRANCH_ID}`);
  });

  it("skips undefined values", () => {
    const params = { tab: "active", page: undefined };
    const url = buildBranchRedirectUrl("/dashboard/students", params, BRANCH_ID);
    expect(url).toContain("tab=active");
    expect(url).not.toContain("page");
    expect(url).toContain(`branch=${BRANCH_ID}`);
  });

  it("handles path with dynamic segments", () => {
    const params = { filter: "overdue" };
    const url = buildBranchRedirectUrl("/dashboard/students/abc-123", params, BRANCH_ID);
    expect(url).toBe(`/dashboard/students/abc-123?filter=overdue&branch=${BRANCH_ID}`);
  });
});

describe("extractNonBranchParams", () => {
  it("removes branch key from params", () => {
    const params = { branch: "x", tab: "active", page: "1" };
    const result = extractNonBranchParams(params);
    expect(result).toEqual({ tab: "active", page: "1" });
  });

  it("skips undefined values", () => {
    const params = { tab: "active", page: undefined };
    const result = extractNonBranchParams(params);
    expect(result).toEqual({ tab: "active" });
  });

  it("returns empty object for branch-only params", () => {
    const params = { branch: "x" };
    const result = extractNonBranchParams(params);
    expect(result).toEqual({});
  });
});
