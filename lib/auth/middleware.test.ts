/**
 * Middleware unit tests — persona prefix guard with composite role rows.
 *
 * These tests validate middleware authorization logic via the pure functions
 * it relies on (parseRoleAssignments, roleNamesFrom, findRouteGuard, hasRequiredRole).
 * The actual Next.js middleware function requires edge runtime which is not
 * available in vitest. We test the logic path it follows.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseRoleAssignments,
  roleNamesFrom,
  findRouteGuard,
  hasRequiredRole,
} from "./authorize";

describe("middleware role parsing (composite rows → role names)", () => {
  it("parses composite RPC rows into role names for guard", () => {
    const rpcData = [
      { role: "admin", branch_id: "aaaaaaaa-1111-2222-3333-444444444444" },
      { role: "teacher", branch_id: "bbbbbbbb-1111-2222-3333-444444444444" },
    ];
    const assignments = parseRoleAssignments(rpcData);
    const roleNames = roleNamesFrom(assignments);
    expect(roleNames.sort()).toEqual(["admin", "teacher"]);
  });

  it("handles owner row with null branch_id", () => {
    const rpcData = [{ role: "owner", branch_id: null }];
    const assignments = parseRoleAssignments(rpcData);
    const roleNames = roleNamesFrom(assignments);
    expect(roleNames).toEqual(["owner"]);
  });

  it("handles null/undefined RPC response gracefully", () => {
    const assignments = parseRoleAssignments(null);
    expect(roleNamesFrom(assignments)).toEqual([]);
  });
});

describe("middleware guard logic", () => {
  it("owner role passes /owner guard, fails /dashboard guard", () => {
    const roleNames = ["owner"] as const;
    const ownerGuard = findRouteGuard("/owner");
    const dashGuard = findRouteGuard("/dashboard");

    expect(hasRequiredRole([...roleNames], ownerGuard!.roles)).toBe(true);
    expect(hasRequiredRole([...roleNames], dashGuard!.roles)).toBe(false);
  });

  it("admin role passes /dashboard guard, fails /owner guard", () => {
    const roleNames = ["admin"] as const;
    const ownerGuard = findRouteGuard("/owner");
    const dashGuard = findRouteGuard("/dashboard");

    expect(hasRequiredRole([...roleNames], dashGuard!.roles)).toBe(true);
    expect(hasRequiredRole([...roleNames], ownerGuard!.roles)).toBe(false);
  });

  it("teacher role passes /dashboard guard, fails /owner guard", () => {
    const roleNames = ["teacher"] as const;
    const ownerGuard = findRouteGuard("/owner");
    const dashGuard = findRouteGuard("/dashboard");

    expect(hasRequiredRole([...roleNames], dashGuard!.roles)).toBe(true);
    expect(hasRequiredRole([...roleNames], ownerGuard!.roles)).toBe(false);
  });

  it("empty roles fail all guards", () => {
    const ownerGuard = findRouteGuard("/owner");
    const dashGuard = findRouteGuard("/dashboard");

    expect(hasRequiredRole([], ownerGuard!.roles)).toBe(false);
    expect(hasRequiredRole([], dashGuard!.roles)).toBe(false);
  });
});

describe("middleware persona separation (property-based)", () => {
  const dashPathArb = fc.constantFrom(
    "/dashboard",
    "/dashboard/branches",
    "/dashboard/students",
    "/dashboard/schedule"
  );
  const ownerPathArb = fc.constantFrom(
    "/owner",
    "/owner/branches",
    "/owner/branches/123/admins"
  );

  it("all dashboard paths resolve to same guard requiring admin|teacher", () => {
    fc.assert(
      fc.property(dashPathArb, (path) => {
        const guard = findRouteGuard(path);
        expect(guard).toBeDefined();
        expect(guard!.roles).toContain("admin");
        expect(guard!.roles).toContain("teacher");
        expect(guard!.roles).not.toContain("owner");
      })
    );
  });

  it("all owner paths resolve to guard requiring only owner", () => {
    fc.assert(
      fc.property(ownerPathArb, (path) => {
        const guard = findRouteGuard(path);
        expect(guard).toBeDefined();
        expect(guard!.roles).toEqual(["owner"]);
      })
    );
  });
});
