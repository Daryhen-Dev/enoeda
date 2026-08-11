import { describe, it, expect } from "vitest";
import {
  isPublicPath,
  findRouteGuard,
  hasRequiredRole,
  parseAppRoles,
  PUBLIC_PATHS,
  ROUTE_GUARDS,
} from "./authorize";

describe("isPublicPath", () => {
  it("returns true for login, auth, api/auth, _next", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/auth/confirm")).toBe(true);
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
  });

  it("returns false for dashboard and root", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });

  it("does not match public path prefix collisions", () => {
    expect(isPublicPath("/loginfoo")).toBe(false);
    expect(isPublicPath("/authentic")).toBe(false);
    expect(isPublicPath("/api/authz")).toBe(false);
  });
});

describe("findRouteGuard", () => {
  it("returns guard for /dashboard and nested paths", () => {
    expect(findRouteGuard("/dashboard")).toBeDefined();
    expect(findRouteGuard("/dashboard/branches/new")).toBeDefined();
  });

  it("returns undefined for unguarded paths", () => {
    expect(findRouteGuard("/about")).toBeUndefined();
    expect(findRouteGuard("/")).toBeUndefined();
    expect(findRouteGuard("/dashboardx")).toBeUndefined();
  });
});

describe("parseAppRoles", () => {
  it("keeps only declared role values from RPC data", () => {
    expect(parseAppRoles(["admin", "owner", 1])).toEqual(["admin"]);
    expect(parseAppRoles("admin")).toEqual([]);
  });
});

describe("hasRequiredRole", () => {
  it("grants when user has required role", () => {
    expect(hasRequiredRole(["admin"], ["admin"])).toBe(true);
    expect(hasRequiredRole(["teacher"], ["teacher"])).toBe(true);
    expect(hasRequiredRole(["admin", "teacher"], ["admin"])).toBe(true);
  });

  it("denies when user lacks required role", () => {
    expect(hasRequiredRole([], ["admin"])).toBe(false);
    expect(hasRequiredRole(["teacher"], ["admin"])).toBe(false);
  });

  it("grants when any required role is met", () => {
    expect(hasRequiredRole(["teacher"], ["admin", "teacher"])).toBe(true);
  });
});

describe("configuration", () => {
  it("PUBLIC_PATHS includes expected paths", () => {
    expect(PUBLIC_PATHS).toContain("/login");
    expect(PUBLIC_PATHS).toContain("/auth");
  });

  it("ROUTE_GUARDS protects dashboard", () => {
    const g = ROUTE_GUARDS.find((r) => r.pathPrefix === "/dashboard");
    expect(g).toBeDefined();
    expect(g!.roles).toEqual(expect.arrayContaining(["admin", "teacher"]));
  });
});
