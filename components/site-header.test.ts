/**
 * SiteHeader URL Preservation Tests — Correction C.
 *
 * Validates that branch switching preserves pathname + all query params.
 * Imports the production helper directly for test fidelity.
 */
import { describe, it, expect } from "vitest";
import { buildBranchSwitchUrl } from "./site-header";

const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("SiteHeader branch switch URL preservation", () => {
  it("preserves existing query params when switching branch", () => {
    const url = buildBranchSwitchUrl(
      "/dashboard/calendar",
      "view=week&date=2024-01-01&branch=old-id",
      BRANCH_ID
    );
    expect(url).toContain("view=week");
    expect(url).toContain("date=2024-01-01");
    expect(url).toContain(`branch=${BRANCH_ID}`);
    expect(url).not.toContain("old-id");
  });

  it("preserves pathname unchanged", () => {
    const url = buildBranchSwitchUrl(
      "/dashboard/students/abc-123",
      "tab=active",
      BRANCH_ID
    );
    expect(url.startsWith("/dashboard/students/abc-123?")).toBe(true);
  });

  it("adds branch to empty params", () => {
    const url = buildBranchSwitchUrl("/dashboard", "", BRANCH_ID);
    expect(url).toBe(`/dashboard?branch=${BRANCH_ID}`);
  });

  it("replaces existing branch without duplicating", () => {
    const url = buildBranchSwitchUrl(
      "/dashboard/payments",
      "branch=old-branch&filter=overdue",
      BRANCH_ID
    );
    // Should have only one branch param
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("branch")).toBe(BRANCH_ID);
    expect(params.get("filter")).toBe("overdue");
    // Count branch keys
    const branchEntries = [...params.entries()].filter(([k]) => k === "branch");
    expect(branchEntries).toHaveLength(1);
  });
});
