import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260818212617_grant_private_schema_usage.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

const AUTHENTICATED_PRIVATE_USAGE_GRANT =
  "GRANT USAGE ON SCHEMA private TO authenticated;";

function grantStatements(source: string): string[] {
  return source.match(/\bgrant\b[\s\S]*?;/gi) ?? [];
}

describe("private schema usage grant", () => {
  it("grants exactly private schema usage to authenticated", () => {
    expect(migration).toContain(AUTHENTICATED_PRIVATE_USAGE_GRANT);
    expect(grantStatements(migration)).toEqual([
      AUTHENTICATED_PRIVATE_USAGE_GRANT,
    ]);
  });

  it("does not grant private schema usage to anon, PUBLIC, or service_role", () => {
    expect(migration).not.toMatch(
      /grant\s+usage\s+on\s+schema\s+private\s+to\s+anon\b/i
    );
    expect(migration).not.toMatch(
      /grant\s+usage\s+on\s+schema\s+private\s+to\s+PUBLIC\b/i
    );
    expect(migration).not.toMatch(
      /grant\s+usage\s+on\s+schema\s+private\s+to\s+service_role\b/i
    );
  });
});
