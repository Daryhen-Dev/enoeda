/**
 * U3 Hardening: set_updated_at search_path fix — structural migration test.
 * Ensures the migration hardens public.set_updated_at() with an immutable
 * (empty) search_path, matching the project convention from U2.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260812000001_harden_set_updated_at_search_path.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

describe("U3 hardening — set_updated_at search_path", () => {
  it("targets public.set_updated_at function", () => {
    expect(migration).toContain("public.set_updated_at()");
  });

  it("uses CREATE OR REPLACE to preserve trigger references", () => {
    expect(migration).toMatch(
      /create or replace function public\.set_updated_at\(\)/i
    );
  });

  it("sets search_path to empty string (immutable convention)", () => {
    expect(migration).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  it("prohibits mutable search_path (no SET without value or with non-empty value)", () => {
    // Ensure no line sets search_path to something other than ''
    const searchPathSettings = migration.match(
      /set\s+search_path\s*=\s*'([^']*)'/gi
    );
    expect(searchPathSettings).not.toBeNull();
    for (const setting of searchPathSettings!) {
      const value = setting.match(/=\s*'([^']*)'/)?.[1];
      expect(value, "search_path must be empty string ''").toBe("");
    }
  });

  it("preserves trigger function contract (returns trigger, plpgsql)", () => {
    expect(migration).toMatch(/returns\s+trigger/i);
    expect(migration).toMatch(/language\s+plpgsql/i);
  });

  it("does not recreate tables, triggers, or policies", () => {
    expect(migration).not.toMatch(/create\s+table/i);
    expect(migration).not.toMatch(/create\s+trigger/i);
    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toMatch(/alter\s+table/i);
    expect(migration).not.toMatch(/drop\s+trigger/i);
  });

  it("preserves the updated_at = now() body logic", () => {
    expect(migration).toContain("new.updated_at = now()");
  });
});
