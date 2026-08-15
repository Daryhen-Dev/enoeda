/**
 * Structural test for migration 20260819000000_progress_and_notes.sql.
 *
 * This file exists for repo consistency with other migration test stubs.
 * The actual structural assertions are run via a standalone Node ESM script
 * (scripts/verify-migration-structure.mjs) since vitest/eslint CLI can hang
 * in the CI-less local env.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "20260819000000_progress_and_notes.sql"
);

describe("20260819000000_progress_and_notes structural checks", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");

  it("creates discipline_levels table", () => {
    expect(sql).toContain("CREATE TABLE public.discipline_levels");
  });

  it("creates student_progress table", () => {
    expect(sql).toContain("CREATE TABLE public.student_progress");
  });

  it("creates student_notes table", () => {
    expect(sql).toContain("CREATE TABLE public.student_notes");
  });

  it("wraps in transaction", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it("enables RLS on all three tables", () => {
    expect(sql).toContain(
      "ALTER TABLE public.discipline_levels ENABLE ROW LEVEL SECURITY"
    );
    expect(sql).toContain(
      "ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY"
    );
    expect(sql).toContain(
      "ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY"
    );
  });

  it("creates policy 6f for initial-level INSERT", () => {
    expect(sql).toContain(
      "Branch-role initial level insert on student_progress"
    );
  });

  it("grants column-level UPDATE on student_notes", () => {
    expect(sql).toContain(
      "GRANT UPDATE (is_completed, completed_at, completed_by) ON public.student_notes TO authenticated"
    );
  });

  it("creates updated_at triggers for discipline_levels and student_notes", () => {
    expect(sql).toContain("discipline_levels_updated_at");
    expect(sql).toContain("student_notes_updated_at");
  });

  it("does NOT create updated_at trigger for student_progress (append-only)", () => {
    expect(sql).not.toContain("student_progress_updated_at");
  });
});
