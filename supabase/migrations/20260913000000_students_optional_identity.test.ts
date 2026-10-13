/**
 * Structural test for migration 20260913000000_students_optional_identity.sql.
 *
 * Mirrors the structural-test style of 20260912000000_student_conduct_records.test.ts:
 * the SQL file is validated textually (transactional shape, ALTER/CHECK/COMMENT
 * presence) since these migrations run against Supabase, not a local test DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "20260913000000_students_optional_identity.sql"
);

const sql = readFileSync(MIGRATION_PATH, "utf-8");

describe("20260913000000_students_optional_identity structural checks", () => {
  it("is transactional and contains no destructive statements", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(?!NOT NULL)/i);
    expect(sql).not.toMatch(/\bCREATE TABLE\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE public\.students\s+ADD COLUMN\b/i);
  });

  it("drops NOT NULL from national_id, email and date_of_birth only", () => {
    expect(sql).toContain(
      "ALTER TABLE public.students ALTER COLUMN national_id DROP NOT NULL;"
    );
    expect(sql).toContain(
      "ALTER TABLE public.students ALTER COLUMN email DROP NOT NULL;"
    );
    expect(sql).toContain(
      "ALTER TABLE public.students ALTER COLUMN date_of_birth DROP NOT NULL;"
    );
    // No other column loses its NOT NULL constraint.
    expect(sql.match(/DROP NOT NULL/g)?.length).toBe(3);
  });

  it("rejects empty/blank national_id while allowing NULL", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.students\s+ADD CONSTRAINT students_national_id_non_blank_ck\s+CHECK \(national_id IS NULL OR btrim\(national_id\) <> ''\);/
    );
  });

  it("rejects empty/blank email while allowing NULL", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.students\s+ADD CONSTRAINT students_email_non_blank_ck\s+CHECK \(email IS NULL OR btrim\(email\) <> ''\);/
    );
  });

  it("keeps the existing UNIQUE indexes untouched (NULLs never conflict)", () => {
    // students_national_id_uq and students_email_normalized_uq are UNIQUE
    // indexes: multiple NULLs are allowed, real duplicates stay rejected. The
    // migration must neither drop nor recreate them (only comments may name them).
    expect(sql).not.toMatch(/\bDROP INDEX\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i);
  });

  it("documents the new nullability with column comments", () => {
    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.students\.national_id IS '[^']+';/
    );
    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.students\.email IS '[^']+';/
    );
    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.students\.date_of_birth IS '[^']+';/
    );
  });
});
