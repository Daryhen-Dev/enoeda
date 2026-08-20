import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260820065044_payment_audit_hardening.sql"
);
const migration = readFileSync(migrationPath, "utf8");

const DROP_POLICY_STATEMENT =
  'DROP POLICY IF EXISTS "Admin branch-scoped payment audit insert" ON public.payment_audit_entries;';

describe("payment audit hardening migration", () => {
  it("wraps the hardening operations in a transaction", () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/i);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/i);
  });

  it("drops only the exact legacy payment audit insert policy", () => {
    expect(migration).toContain(DROP_POLICY_STATEMENT);
    expect(migration.match(/\bDROP\s+POLICY\b/gi)).toHaveLength(1);
  });

  it("creates an idempotent partial actor index", () => {
    expect(migration).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+payment_audit_entries_actor_id_idx\s+ON\s+public\.payment_audit_entries\s*\(\s*actor_id\s*\)\s+WHERE\s+actor_id\s+IS\s+NOT\s+NULL\s*;/i
    );
  });
});
