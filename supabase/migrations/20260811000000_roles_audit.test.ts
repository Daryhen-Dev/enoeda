import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260811000000_roles_audit.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");
const adminPolicyStart = migration.indexOf(
  'create policy "Admin can read all roles"'
);
const adminPolicyEnd = migration.indexOf("-- 5. Revoke DML privileges", adminPolicyStart);
const adminPolicy = migration.slice(adminPolicyStart, adminPolicyEnd);

describe("roles audit migration structure", () => {
  it("declares the private helper before all role policies", () => {
    const helperStart = migration.indexOf(
      "create or replace function private.has_role"
    );
    const firstPolicyStart = migration.indexOf("create policy");

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(firstPolicyStart).toBeGreaterThanOrEqual(0);
    expect(helperStart).toBeLessThan(firstPolicyStart);
    expect(migration).toMatch(
      /language sql stable security definer set search_path = ''/
    );
    expect(migration).toMatch(/from public\.user_roles/);
  });

  it("declares the admin select policy through private.has_role", () => {
    expect(adminPolicy).toContain(
      "private.has_role(auth.uid(), 'admin'::public.role_enum)"
    );
    expect(adminPolicy).not.toMatch(/from\s+public\.user_roles/i);
  });

  it("omits the unattached private.set_audit declaration", () => {
    expect(migration).not.toContain("private.set_audit");
  });

  it("retains role assignment and revocation authorship columns", () => {
    expect(migration).toMatch(/assigned_by uuid references auth\.users\(id\)/);
    expect(migration).toMatch(/assigned_at timestamptz not null default now\(\)/);
    expect(migration).toMatch(/revoked_by uuid references auth\.users\(id\)/);
    expect(migration).toMatch(/revoked_at timestamptz/);
  });
});