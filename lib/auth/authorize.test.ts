import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isPublicPath,
  findRouteGuard,
  hasRequiredRole,
  parseAppRoles,
  parseRoleAssignments,
  roleNamesFrom,
  PUBLIC_PATHS,
  ROUTE_GUARDS,
  APP_ROLES,
  type AppRoleAssignment,
} from "./authorize";

describe("isPublicPath", () => {
  it("returns true for login, auth, api/auth, _next", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/auth/confirm")).toBe(true);
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
  });

  it("returns false for dashboard, owner, and root", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/owner")).toBe(false);
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

  it("returns guard for /owner and nested paths", () => {
    expect(findRouteGuard("/owner")).toBeDefined();
    expect(findRouteGuard("/owner/branches/123")).toBeDefined();
  });

  it("returns undefined for unguarded paths", () => {
    expect(findRouteGuard("/about")).toBeUndefined();
    expect(findRouteGuard("/")).toBeUndefined();
    expect(findRouteGuard("/dashboardx")).toBeUndefined();
  });
});

describe("parseAppRoles", () => {
  it("keeps only declared role values from flat string array", () => {
    expect(parseAppRoles(["admin", "unknown", 1])).toEqual(["admin"]);
    expect(parseAppRoles(["owner", "teacher"])).toEqual(["owner", "teacher"]);
    expect(parseAppRoles("admin")).toEqual([]);
  });
});

describe("parseRoleAssignments", () => {
  it("parses composite RPC rows into AppRoleAssignment[]", () => {
    const input = [
      { role: "admin", branch_id: "aaaaaaaa-1111-2222-3333-444444444444" },
      { role: "teacher", branch_id: "bbbbbbbb-1111-2222-3333-444444444444" },
    ];
    const result = parseRoleAssignments(input);
    expect(result).toEqual([
      { role: "admin", branchId: "aaaaaaaa-1111-2222-3333-444444444444" },
      { role: "teacher", branchId: "bbbbbbbb-1111-2222-3333-444444444444" },
    ]);
  });

  it("handles owner row with null branch_id", () => {
    const input = [{ role: "owner", branch_id: null }];
    const result = parseRoleAssignments(input);
    expect(result).toEqual([{ role: "owner", branchId: null }]);
  });

  it("filters unrecognized roles from composite rows", () => {
    const input = [
      { role: "admin", branch_id: "aaaa-1111-2222-3333-444444444444" },
      { role: "superuser", branch_id: null },
    ];
    const result = parseRoleAssignments(input);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("admin");
  });

  it("returns empty array for null/undefined/non-array input", () => {
    expect(parseRoleAssignments(null)).toEqual([]);
    expect(parseRoleAssignments(undefined)).toEqual([]);
    expect(parseRoleAssignments("admin")).toEqual([]);
  });
});

describe("roleNamesFrom", () => {
  it("extracts unique role names from assignments", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "admin", branchId: "aaaa" },
      { role: "admin", branchId: "bbbb" },
      { role: "teacher", branchId: "aaaa" },
    ];
    const names = roleNamesFrom(assignments);
    expect(names.sort()).toEqual(["admin", "teacher"]);
  });

  it("returns empty array for empty assignments", () => {
    expect(roleNamesFrom([])).toEqual([]);
  });
});

describe("hasRequiredRole", () => {
  it("grants when user has required role", () => {
    expect(hasRequiredRole(["admin"], ["admin"])).toBe(true);
    expect(hasRequiredRole(["teacher"], ["teacher"])).toBe(true);
    expect(hasRequiredRole(["admin", "teacher"], ["admin"])).toBe(true);
    expect(hasRequiredRole(["owner"], ["owner"])).toBe(true);
  });

  it("denies when user lacks required role", () => {
    expect(hasRequiredRole([], ["admin"])).toBe(false);
    expect(hasRequiredRole(["teacher"], ["admin"])).toBe(false);
    expect(hasRequiredRole(["owner"], ["admin", "teacher"])).toBe(false);
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

  it("ROUTE_GUARDS protects dashboard with admin|teacher (owner excluded)", () => {
    const g = ROUTE_GUARDS.find((r) => r.pathPrefix === "/dashboard");
    expect(g).toBeDefined();
    expect(g!.roles).toEqual(expect.arrayContaining(["admin", "teacher"]));
    expect(g!.roles).not.toContain("owner");
  });

  it("ROUTE_GUARDS protects /owner with owner only", () => {
    const g = ROUTE_GUARDS.find((r) => r.pathPrefix === "/owner");
    expect(g).toBeDefined();
    expect(g!.roles).toEqual(["owner"]);
  });

  it("APP_ROLES includes owner", () => {
    expect(APP_ROLES.OWNER).toBe("owner");
  });
});

describe("persona separation (property-based)", () => {
  it("owner is never authorized for /dashboard", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/dashboard", "/dashboard/branches", "/dashboard/staff"),
        (path) => {
          const guard = findRouteGuard(path);
          expect(guard).toBeDefined();
          expect(hasRequiredRole(["owner"], guard!.roles)).toBe(false);
        }
      )
    );
  });

  it("admin/teacher are never authorized for /owner", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/owner", "/owner/branches", "/owner/branches/abc/admins"),
        (path) => {
          const guard = findRouteGuard(path);
          expect(guard).toBeDefined();
          expect(hasRequiredRole(["admin"], guard!.roles)).toBe(false);
          expect(hasRequiredRole(["teacher"], guard!.roles)).toBe(false);
        }
      )
    );
  });
});
