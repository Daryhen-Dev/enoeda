/**
 * Redirect utility tests — persona home routing and safe redirect validation.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getPersonaHome, getSafeRedirect } from "./redirect";

describe("getPersonaHome", () => {
  it("returns /owner for owner role", () => {
    expect(getPersonaHome(["owner"])).toBe("/owner");
  });

  it("returns /dashboard for admin role", () => {
    expect(getPersonaHome(["admin"])).toBe("/dashboard");
  });

  it("returns /dashboard for teacher role", () => {
    expect(getPersonaHome(["teacher"])).toBe("/dashboard");
  });

  it("returns /dashboard when no roles (safe default)", () => {
    expect(getPersonaHome([])).toBe("/dashboard");
  });

  it("returns /owner when owner is among multiple roles", () => {
    // Edge case: user has both owner and admin (shouldn't happen per model, but handles gracefully)
    expect(getPersonaHome(["owner", "admin"])).toBe("/owner");
  });
});

describe("getSafeRedirect", () => {
  it("accepts valid /dashboard paths", () => {
    expect(getSafeRedirect("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("/dashboard/branches")).toBe("/dashboard/branches");
  });

  it("accepts valid /owner paths", () => {
    expect(getSafeRedirect("/owner")).toBe("/owner");
    expect(getSafeRedirect("/owner/branches/123")).toBe("/owner/branches/123");
  });

  it("rejects paths outside allowed prefixes", () => {
    expect(getSafeRedirect("/login")).toBe("/dashboard");
    expect(getSafeRedirect("/")).toBe("/dashboard");
    expect(getSafeRedirect("/admin")).toBe("/dashboard");
  });

  it("rejects path traversal", () => {
    expect(getSafeRedirect("/dashboard/../etc")).toBe("/dashboard");
    expect(getSafeRedirect("/owner/..")).toBe("/dashboard");
  });

  it("rejects disallowed characters", () => {
    expect(getSafeRedirect("/dashboard?foo=bar")).toBe("/dashboard");
    expect(getSafeRedirect("/owner#section")).toBe("/dashboard");
    expect(getSafeRedirect("/dashboard%20stuff")).toBe("/dashboard");
  });

  it("rejects non-string inputs", () => {
    expect(getSafeRedirect(null)).toBe("/dashboard");
    expect(getSafeRedirect(undefined)).toBe("/dashboard");
    expect(getSafeRedirect(42)).toBe("/dashboard");
    expect(getSafeRedirect("")).toBe("/dashboard");
  });

  describe("with roles argument", () => {
    it("defaults to persona home when redirect is invalid", () => {
      expect(getSafeRedirect("/invalid", ["owner"])).toBe("/owner");
      expect(getSafeRedirect("/invalid", ["admin"])).toBe("/dashboard");
    });

    it("rejects /owner redirect for non-owner roles", () => {
      expect(getSafeRedirect("/owner/branches", ["admin"])).toBe("/dashboard");
      expect(getSafeRedirect("/owner", ["teacher"])).toBe("/dashboard");
    });

    it("rejects /dashboard redirect for owner-only user", () => {
      expect(getSafeRedirect("/dashboard", ["owner"])).toBe("/owner");
    });

    it("allows /owner redirect for owner role", () => {
      expect(getSafeRedirect("/owner/branches", ["owner"])).toBe("/owner/branches");
    });

    it("allows /dashboard redirect for admin/teacher roles", () => {
      expect(getSafeRedirect("/dashboard/students", ["admin"])).toBe("/dashboard/students");
      expect(getSafeRedirect("/dashboard/schedule", ["teacher"])).toBe("/dashboard/schedule");
    });
  });
});

describe("getPersonaHome (property-based)", () => {
  const roleArb = fc.constantFrom("owner", "admin", "teacher") as fc.Arbitrary<"owner" | "admin" | "teacher">;

  it("owner always maps to /owner, non-owner always maps to /dashboard", () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const home = getPersonaHome([role]);
        if (role === "owner") {
          expect(home).toBe("/owner");
        } else {
          expect(home).toBe("/dashboard");
        }
      })
    );
  });

  it("result is always one of two valid persona homes", () => {
    fc.assert(
      fc.property(
        fc.array(roleArb, { minLength: 0, maxLength: 3 }),
        (roles) => {
          const home = getPersonaHome(roles);
          expect(["/owner", "/dashboard"]).toContain(home);
        }
      )
    );
  });
});
