/**
 * U2 Integration Tests: Roles + Audit
 * Validates: role authority, DML denial defense, audit-spoof defense, 403 paths.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasRequiredRole,
  isPublicPath,
  findRouteGuard,
} from "@/lib/auth/authorize";
import { fetchCurrentRoles, fetchRoleAssignments } from "@/lib/auth/server-roles";

describe("U2 Roles — Role Authority", () => {
  it("admin role grants access to dashboard", () => {
    const guard = findRouteGuard("/dashboard/branches");
    expect(guard).toBeDefined();
    expect(hasRequiredRole(["admin"], guard!.roles)).toBe(true);
  });

  it("teacher role grants access to dashboard", () => {
    const guard = findRouteGuard("/dashboard");
    expect(hasRequiredRole(["teacher"], guard!.roles)).toBe(true);
  });

  it("admin+teacher composite role has access", () => {
    const guard = findRouteGuard("/dashboard");
    expect(hasRequiredRole(["admin", "teacher"], guard!.roles)).toBe(true);
  });

  it("no roles denies access to protected paths", () => {
    const guard = findRouteGuard("/dashboard");
    expect(hasRequiredRole([], guard!.roles)).toBe(false);
  });
});

describe("U2 Roles — DML Denial Defense", () => {
  it("authorize module has no direct DML helper functions", async () => {
    const authorizeModule = await import("@/lib/auth/authorize");
    const exportedKeys = Object.keys(authorizeModule);
    const mutationPatterns = ["insert", "update", "delete", "mutate", "write"];
    for (const pattern of mutationPatterns) {
      const hasMutation = exportedKeys.some((key) =>
        key.toLowerCase().includes(pattern)
      );
      expect(hasMutation, `Should not export '${pattern}' helpers`).toBe(false);
    }
  });

  it("authorize module has no server I/O (Edge-safe, no createClient)", async () => {
    const authorizeModule = await import("@/lib/auth/authorize");
    const mod = authorizeModule as unknown as Record<string, unknown>;
    const functions = Object.keys(mod).filter(
      (key) => typeof mod[key] === "function"
    );
    const allowed = [
      "isPublicPath", "findRouteGuard", "hasRequiredRole", "parseAppRoles",
      "parseRoleAssignments", "roleNamesFrom",
    ];
    for (const fn of functions) {
      expect(allowed.includes(fn), `Unexpected export: ${fn}`).toBe(true);
    }
  });
});

describe("U2 Roles — Audit Spoof Defense", () => {
  it("fetchCurrentRoles does not accept a user_id parameter", () => {
    expect(fetchCurrentRoles.length).toBe(0);
  });

  it("fetchRoleAssignments does not accept a user_id parameter", () => {
    expect(fetchRoleAssignments.length).toBe(0);
  });
});

describe("U2 Roles — 403 Unauthorized Protected Paths", () => {
  it("returns false authorization for no-role user on protected path", () => {
    const guard = findRouteGuard("/dashboard/students");
    expect(guard).toBeDefined();
    expect(hasRequiredRole([], guard!.roles)).toBe(false);
  });

  it("public paths are not guarded", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(findRouteGuard("/login")).toBeUndefined();
  });

  it("unmatched paths have no guard (safe passthrough)", () => {
    expect(findRouteGuard("/")).toBeUndefined();
    expect(findRouteGuard("/about")).toBeUndefined();
  });

  it("nested dashboard paths inherit dashboard guard", () => {
    const paths = ["/dashboard/branches", "/dashboard/students", "/dashboard/schedule"];
    for (const path of paths) {
      expect(findRouteGuard(path), `Guard for ${path}`).toBeDefined();
    }
  });
});
