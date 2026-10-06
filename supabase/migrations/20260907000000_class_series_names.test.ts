import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260907000000_class_series_names.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Class series names migration — structural validation", () => {
  it("creates the class_series catalog table with a branch index", () => {
    expect(sql).toMatch(
      /CREATE TABLE public\.class_series \([\s\S]*?id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\),[\s\S]*?branch_id uuid NOT NULL REFERENCES public\.branches\(id\) ON DELETE CASCADE,[\s\S]*?name text NOT NULL,[\s\S]*?created_at timestamptz NOT NULL DEFAULT now\(\)[\s\S]*?\);/
    );
    expect(sql).toMatch(
      /CREATE INDEX class_series_branch_id_idx\s+ON public\.class_series \(branch_id\)/
    );
  });

  it("backfills exactly one named row per distinct existing series_id", () => {
    expect(sql).toMatch(
      /INSERT INTO public\.class_series \(id, branch_id, name\)\s+SELECT\s+sc\.series_id,\s+sc\.branch_id,\s+min\(d\.name\) \|\| ' — ' \|\| to_char\(min\(sc\.start_time\), 'HH24:MI'\)\s+FROM public\.scheduled_classes sc\s+JOIN public\.disciplines d ON d\.id = sc\.discipline_id\s+GROUP BY sc\.series_id, sc\.branch_id/
    );
  });

  it("adds the scheduled_classes.series_id foreign key to class_series", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.scheduled_classes\s+ADD CONSTRAINT scheduled_classes_series_id_fkey\s+FOREIGN KEY \(series_id\) REFERENCES public\.class_series\(id\)/
    );
  });

  it("enables and forces RLS on class_series with the scheduled_classes policy shape", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.class_series ENABLE ROW LEVEL SECURITY/
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.class_series FORCE ROW LEVEL SECURITY/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Owner full access on class_series"\s+ON public\.class_series FOR ALL TO authenticated\s+USING \(private\.has_role\(auth\.uid\(\), 'owner'::public\.role_enum\)\)\s+WITH CHECK \(private\.has_role\(auth\.uid\(\), 'owner'::public\.role_enum\)\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Admin branch-scoped write on class_series"\s+ON public\.class_series FOR ALL TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, branch_id\)\)\s+WITH CHECK \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, branch_id\)\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Admin global read on class_series"\s+ON public\.class_series FOR SELECT TO authenticated\s+USING \(private\.has_any_admin_role\(auth\.uid\(\)\)\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Teacher branch-scoped read on class_series"\s+ON public\.class_series FOR SELECT TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, branch_id\)\)/
    );
  });

  it("mirrors the scheduled_classes grant statements", () => {
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.class_series FROM anon/
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.class_series TO authenticated/
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
