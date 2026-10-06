import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260908000000_branch_level_requirements.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Branch level requirements migration — structural validation", () => {
  it("creates the per-branch override table with uniqueness and non-negative check", () => {
    expect(sql).toMatch(
      /CREATE TABLE public\.branch_level_requirements \([\s\S]*?id\s+uuid PRIMARY KEY DEFAULT gen_random_uuid\(\),[\s\S]*?branch_id\s+uuid NOT NULL REFERENCES public\.branches\(id\) ON DELETE CASCADE,[\s\S]*?level_id\s+uuid NOT NULL REFERENCES public\.discipline_levels\(id\) ON DELETE CASCADE,[\s\S]*?required_attended_sessions\s+integer NOT NULL,[\s\S]*?updated_by\s+uuid,[\s\S]*?created_at\s+timestamptz NOT NULL DEFAULT now\(\),[\s\S]*?updated_at\s+timestamptz NOT NULL DEFAULT now\(\),[\s\S]*?CONSTRAINT branch_level_requirements_required_nonneg_ck\s+CHECK \(required_attended_sessions >= 0\),[\s\S]*?CONSTRAINT branch_level_requirements_branch_level_uq UNIQUE \(branch_id, level_id\)[\s\S]*?\);/
    );
    expect(sql).toMatch(
      /CREATE INDEX branch_level_requirements_level_id_idx\s+ON public\.branch_level_requirements \(level_id\)/
    );
  });

  it("reuses the shared set_updated_at trigger function", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER branch_level_requirements_updated_at\s+BEFORE UPDATE ON public\.branch_level_requirements\s+FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\)/
    );
  });

  it("enables and forces RLS with owner, branch admin and branch teacher policies", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.branch_level_requirements ENABLE ROW LEVEL SECURITY/
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.branch_level_requirements FORCE ROW LEVEL SECURITY/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Owner full access on branch_level_requirements"\s+ON public\.branch_level_requirements FOR ALL TO authenticated\s+USING \(private\.has_role\(auth\.uid\(\), 'owner'::public\.role_enum\)\)\s+WITH CHECK \(private\.has_role\(auth\.uid\(\), 'owner'::public\.role_enum\)\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Admin branch-scoped write on branch_level_requirements"\s+ON public\.branch_level_requirements FOR ALL TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, branch_id\)\)\s+WITH CHECK \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, branch_id\)\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Teacher branch-scoped read on branch_level_requirements"\s+ON public\.branch_level_requirements FOR SELECT TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, branch_id\)\)/
    );
  });

  it("mirrors the class_series grant statements", () => {
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.branch_level_requirements FROM anon/
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.branch_level_requirements TO authenticated/
    );
  });

  it("is transactional and contains no destructive statements", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    // "ON DELETE CASCADE" and "REVOKE ... DELETE" are legitimate here; the
    // ban targets destructive statements, not the word DELETE itself.
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|POLICY|FUNCTION)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
