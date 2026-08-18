import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260818172650_harden_enforce_active_student_branch_execution.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

const FUNCTION_SIGNATURE = "public.enforce_active_student_branch()";
const REVOKED_ROLES = [
  "PUBLIC",
  "anon",
  "authenticated",
  "service_role",
] as const;

describe("enforce_active_student_branch execution hardening", () => {
  it("wraps the privilege change in a transaction", () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/i);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/i);
  });

  it("revokes execution of the exact trigger function signature from every Data API role", () => {
    const revokeStatement = new RegExp(
      `revoke\\s+execute\\s+on\\s+function\\s+${FUNCTION_SIGNATURE.replace(/[().]/g, "\\$&")}\\s+from\\s+${REVOKED_ROLES.join("\\s*,\\s*")}\\s*;`,
      "i"
    );

    expect(migration).toMatch(revokeStatement);
  });

  it("does not grant execution or change function, trigger, table, or policy definitions", () => {
    expect(migration).not.toMatch(/grant\s+execute/i);
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/alter\s+function/i);
    expect(migration).not.toMatch(/create\s+trigger/i);
    expect(migration).not.toMatch(/drop\s+trigger/i);
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/create\s+policy/i);
  });
});
