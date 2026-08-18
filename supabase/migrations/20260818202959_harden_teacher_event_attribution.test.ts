import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260818202959_harden_teacher_event_attribution.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

const FUNCTION_SIGNATURE = "public.enforce_active_student_branch()";
const REVOKE_STATEMENT =
  "REVOKE EXECUTE ON FUNCTION public.enforce_active_student_branch() FROM PUBLIC, anon, authenticated, service_role;";
const TEACHER_POLICY_NAME =
  "Teacher branch-scoped insert on discipline_events";

function policyBlock(source: string): string {
  const createIndex = source.search(
    new RegExp(`create\\s+policy\\s+"${TEACHER_POLICY_NAME}"`, "i")
  );

  expect(createIndex).toBeGreaterThanOrEqual(0);
  return source.slice(createIndex);
}

describe("teacher event attribution hardening", () => {
  it("wraps every change in a transaction", () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/i);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/i);
  });

  it("defines the exact trigger function as security definer with an empty search path", () => {
    expect(migration).toMatch(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+${FUNCTION_SIGNATURE.replace(/[().]/g, "\\$&")}\\s+returns\\s+trigger\\s+language\\s+plpgsql\\s+security\\s+definer\\s+set\\s+search_path\\s*=\\s*''`,
        "i"
      )
    );
  });

  it("preserves active-student branch validation with row locking and 23514 failures", () => {
    expect(migration).toMatch(/if\s+NEW\.is_active\s+then/i);
    expect(migration).toMatch(/from\s+public\.branches\s+as\s+branch/i);
    expect(migration).toMatch(/where\s+branch\.id\s*=\s*NEW\.branch_id\s+for\s+update/i);
    expect(migration).toMatch(/if\s+not\s+found\s+then[\s\S]*?ERRCODE\s*=\s*'23514'/i);
    expect(migration).toMatch(
      /if\s+target_branch_is_active\s+is\s+not\s+true\s+then[\s\S]*?ERRCODE\s*=\s*'23514'/i
    );
    expect(migration).toMatch(/return\s+NEW/i);
  });

  it("revokes execution from exactly the required roles without granting it", () => {
    expect(migration).toContain(REVOKE_STATEMENT);
    expect(migration).not.toMatch(/\bgrant\s+execute\b/i);
  });

  it("replaces only the teacher branch-scoped discipline event insert policy", () => {
    const dropStatement = new RegExp(
      `drop\\s+policy\\s+if\\s+exists\\s+"${TEACHER_POLICY_NAME}"\\s+on\\s+public\\.discipline_events\\s*;`,
      "i"
    );
    const createStatement = new RegExp(
      `create\\s+policy\\s+"${TEACHER_POLICY_NAME}"\\s+on\\s+public\\.discipline_events\\s+for\\s+insert\\s+to\\s+authenticated\\s+with\\s+check\\s*\\(`,
      "i"
    );

    expect(migration).toMatch(dropStatement);
    expect(migration).toMatch(createStatement);
    expect(migration.match(/create\s+policy/gi)).toHaveLength(1);
    expect(migration).not.toMatch(/alter\s+policy/i);
  });

  it("keeps the inserted enrollment branch-scoped and attributes it to the caller", () => {
    const policy = policyBlock(migration);

    expect(policy).toMatch(/private\.has_branch_role\s*\(/i);
    expect(policy).toMatch(/auth\.uid\(\)\s*,\s*'teacher'::public\.role_enum/i);
    expect(policy).toMatch(/private\.student_branch_id\s*\(/i);
    expect(policy).toMatch(/from\s+public\.student_disciplines\s+as\s+student_discipline/i);
    expect(policy).toMatch(
      /where\s+student_discipline\.id\s*=\s*student_discipline_id/i
    );
    expect(policy).toMatch(/and\s+performed_by\s*=\s*\(select\s+auth\.uid\(\)\)/i);
    expect(policy).not.toMatch(/event_type/i);
  });
});
