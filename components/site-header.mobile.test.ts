/**
 * SiteHeader — Mobile behavior and state/eligibility tests.
 *
 * Tests pure logic: branch eligibility, URL building, and state derivation.
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
