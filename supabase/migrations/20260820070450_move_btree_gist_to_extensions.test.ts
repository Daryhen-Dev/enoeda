import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(__dirname, "20260820070450_move_btree_gist_to_extensions.sql"),
  "utf8"
);

describe("move btree_gist to extensions migration", () => {
  it("relocates the extension in a transaction", () => {
    expect(migration.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toContain("CREATE SCHEMA IF NOT EXISTS extensions;");
    expect(migration).toContain("ALTER EXTENSION btree_gist SET SCHEMA extensions;");
  });

  it("does not recreate or drop the extension and its dependent indexes", () => {
    expect(migration).not.toMatch(/DROP\s+EXTENSION/i);
    expect(migration).not.toMatch(/CREATE\s+EXTENSION/i);
    expect(migration).not.toMatch(/DROP\s+(?:INDEX|CONSTRAINT)/i);
  });
});
