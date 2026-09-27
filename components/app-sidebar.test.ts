import { describe, expect, it } from "vitest";

import { getActiveNavigationItemUrl } from "./app-sidebar";

const DASHBOARD_ROUTES = [
  { url: "/dashboard" },
  { url: "/dashboard/students" },
  { url: "/dashboard/staff" },
] as const;

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
