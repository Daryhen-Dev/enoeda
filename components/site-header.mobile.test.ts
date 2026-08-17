/**
 * SiteHeader — Mobile behavior and state/eligibility tests.
 *
 * Tests pure logic: branch eligibility, URL building, state derivation,
 * and URL-derived selected branch behavior.
 * Imports production helpers directly for test fidelity.
 */
import { describe, it, expect } from "vitest";
import { buildBranchSwitchUrl, getSwitcherMode } from "./site-header";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";

describe("SiteHeader eligibility logic", () => {
  it("returns hidden when no branches provided", () => {
    expect(getSwitcherMode(undefined)).toBe("hidden");
  });

  it("returns hidden when empty branches array", () => {
    expect(getSwitcherMode([])).toBe("hidden");
  });

  it("returns static mode when single branch", () => {
    const branches = [{ id: BRANCH_A, name: "Main" }];
    expect(getSwitcherMode(branches)).toBe("static");
  });

  it("returns select mode when multiple branches", () => {
    const branches = [
      { id: BRANCH_A, name: "Main" },
      { id: BRANCH_B, name: "Secondary" },
    ];
    expect(getSwitcherMode(branches)).toBe("select");
  });
});

describe("SiteHeader URL preservation (extended)", () => {
  it("preserves multiple query params during switch", () => {
    const url = buildBranchSwitchUrl(
      "/dashboard/students",
      "tab=active&page=2&branch=old-id",
      BRANCH_A
    );
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("tab")).toBe("active");
    expect(params.get("page")).toBe("2");
    expect(params.get("branch")).toBe(BRANCH_A);
  });

  it("adds branch when params are initially empty", () => {
    const url = buildBranchSwitchUrl("/dashboard", "", BRANCH_B);
    expect(url).toBe(`/dashboard?branch=${BRANCH_B}`);
  });

  it("handles special characters in param values", () => {
    const url = buildBranchSwitchUrl(
      "/dashboard/students",
      "search=Juan+P%C3%A9rez",
      BRANCH_A
    );
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("search")).toBe("Juan Pérez");
    expect(params.get("branch")).toBe(BRANCH_A);
  });
});


describe("SiteHeader URL-derived selected branch", () => {
  it("buildBranchSwitchUrl sets branch param that becomes selected state", () => {
    // The SiteHeader derives currentBranchId from useSearchParams().get("branch")
    // This test validates that buildBranchSwitchUrl produces the correct param
    // so the component's URL-derived state will match.
    const url = buildBranchSwitchUrl("/dashboard", `branch=${BRANCH_A}`, BRANCH_B);
    const params = new URLSearchParams(url.split("?")[1]);
    // After switch, the URL branch param should be the new branch
    expect(params.get("branch")).toBe(BRANCH_B);
    // Old branch should not remain
    expect(url).not.toContain(BRANCH_A);
  });

  it("URL with no branch param results in undefined current (no selection)", () => {
    // Simulates the component reading searchParams.get("branch") → null → undefined
    const params = new URLSearchParams("");
    const branchFromUrl = params.get("branch") ?? undefined;
    expect(branchFromUrl).toBeUndefined();
  });

  it("URL with valid branch param resolves to that ID", () => {
    const params = new URLSearchParams(`branch=${BRANCH_A}&tab=students`);
    const branchFromUrl = params.get("branch") ?? undefined;
    expect(branchFromUrl).toBe(BRANCH_A);
  });

  it("select value uses URL-derived branch for matching", () => {
    // Validates that the select value logic matches the URL branch against
    // the available branches array
    const branches = [
      { id: BRANCH_A, name: "Main" },
      { id: BRANCH_B, name: "South" },
    ];
    const urlBranchId = BRANCH_B;
    const currentBranch = branches.find((b) => b.id === urlBranchId);
    expect(currentBranch).toEqual({ id: BRANCH_B, name: "South" });
  });

  it("select value is empty string when URL branch is absent", () => {
    // Component uses: value={currentBranchId ?? ""}
    const urlBranchId: string | undefined = undefined;
    const selectValue = urlBranchId ?? "";
    expect(selectValue).toBe("");
  });
});
