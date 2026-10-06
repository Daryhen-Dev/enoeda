import { describe, expect, it } from "vitest";

import {
  buildNavigationHref,
  getActiveNavigationItemUrl,
} from "./app-sidebar";

const DASHBOARD_ROUTES = [
  { url: "/dashboard" },
  { url: "/dashboard/students" },
  { url: "/dashboard/staff" },
] as const;

describe("buildNavigationHref", () => {
  it("appends the branch query to branch-scoped items", () => {
    expect(buildNavigationHref("/dashboard", true, "b_123")).toBe(
      "/dashboard?branch=b_123"
    );
    expect(
      buildNavigationHref("/dashboard/students", true, "b_123")
    ).toBe("/dashboard/students?branch=b_123");
  });

  it("keeps non-branch-scoped items unchanged even with a branch id", () => {
    expect(
      buildNavigationHref("/dashboard/profile", false, "b_123")
    ).toBe("/dashboard/profile");
  });

  it("keeps every item unchanged when no branch id is available", () => {
    expect(buildNavigationHref("/dashboard", true, null)).toBe("/dashboard");
    expect(
      buildNavigationHref("/dashboard/profile", false, null)
    ).toBe("/dashboard/profile");
  });

  it("preserves an existing non-branch query on the item", () => {
    expect(
      buildNavigationHref("/dashboard/calendar?view=week", true, "b_123")
    ).toBe("/dashboard/calendar?view=week&branch=b_123");
    expect(
      buildNavigationHref("/dashboard/calendar?view=week", true, null)
    ).toBe("/dashboard/calendar?view=week");
  });

  it("encodes a branch id that would otherwise inject query pairs", () => {
    expect(buildNavigationHref("/dashboard", true, "a&b=c")).toBe(
      "/dashboard?branch=a%26b%3Dc"
    );
  });
});

describe("getActiveNavigationItemUrl", () => {
  it("selects only the deepest matching dashboard route", () => {
    expect(
      getActiveNavigationItemUrl(DASHBOARD_ROUTES, "/dashboard/students")
    ).toBe("/dashboard/students");
  });

  it("keeps the overview exact so it does not claim nested routes", () => {
    expect(getActiveNavigationItemUrl(DASHBOARD_ROUTES, "/dashboard")).toBe(
      "/dashboard"
    );
    expect(
      getActiveNavigationItemUrl(DASHBOARD_ROUTES, "/dashboard/staff")
    ).toBe("/dashboard/staff");
  });

  it("returns no active navigation item for an unrelated path", () => {
    expect(getActiveNavigationItemUrl(DASHBOARD_ROUTES, "/student")).toBeNull();
  });
});
