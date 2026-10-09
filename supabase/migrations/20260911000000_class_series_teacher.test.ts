import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260911000000_class_series_teacher.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("set_class_series_teacher migration — structural validation", () => {
  it("is transactional (BEGIN/COMMIT) and destructive statements are absent", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
  });

  it("defines set_class_series_teacher with the RPC signature and definer hardening", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_class_series_teacher\(\s+p_series_id uuid, p_teacher_id uuid\s+\) RETURNS jsonb\s+LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/
    );
  });

  it("raises class_series_not_found when the series does not exist", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'class_series_not_found'/);
  });

  it("requires owner or branch-admin before doing anything", () => {
    expect(sql).toMatch(
      /private\.has_role\(auth\.uid\(\),'owner'::public\.role_enum\)\s+OR private\.has_branch_role\(auth\.uid\(\),'admin'::public\.role_enum,/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'unauthorized: insufficient privileges'/
    );
  });

  it("validates the target teacher holds an active teacher role in the series branch, but only when p_teacher_id is not null", () => {
    expect(sql).toMatch(/IF p_teacher_id IS NOT NULL THEN/);
    expect(sql).toMatch(
      /SELECT 1 FROM public\.user_roles\s+WHERE user_id=p_teacher_id AND role='teacher'::public\.role_enum\s+AND branch_id=v_branch_id AND revoked_at IS NULL/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'invalid_teacher: teacher must have an active teacher role in this branch'/
    );
  });

  it("iterates only the ACTIVE scheduled_classes rows of the series", () => {
    expect(sql).toMatch(
      /SELECT id, default_teacher_id\s+FROM public\.scheduled_classes\s+WHERE series_id=p_series_id AND is_active=true/
    );
  });

  it("inserts a baseline period (old teacher, -infinity → cutoff) for rows without any attribution period", () => {
    expect(sql).toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM public\.teacher_attribution_periods tap\s+WHERE tap\.scheduled_class_id=v_row\.id\) THEN/
    );
    expect(sql).toMatch(
      /INSERT INTO public\.teacher_attribution_periods \(scheduled_class_id, teacher_id, effective_from, effective_until\)\s+VALUES \(v_row\.id, v_row\.default_teacher_id, '-infinity'::timestamptz, v_cut\)/
    );
  });

  it("closes open periods with the cutoff for rows that already have periods", () => {
    expect(sql).toMatch(
      /UPDATE public\.teacher_attribution_periods SET effective_until=v_cut\s+WHERE scheduled_class_id=v_row\.id AND effective_until IS NULL/
    );
  });

  it("opens the new period only when a teacher is given", () => {
    expect(sql).toMatch(
      /IF p_teacher_id IS NOT NULL THEN\s+INSERT INTO public\.teacher_attribution_periods \(scheduled_class_id, teacher_id, effective_from\)\s+VALUES \(v_row\.id, p_teacher_id, v_cut\)/
    );
  });

  it("updates default_teacher_id on the series weekday rows and on the group", () => {
    expect(sql).toMatch(
      /UPDATE public\.scheduled_classes SET default_teacher_id=p_teacher_id\s+WHERE series_id=p_series_id AND is_active=true/
    );
    expect(sql).toMatch(
      /UPDATE public\.class_series SET default_teacher_id=p_teacher_id\s+WHERE id=p_series_id/
    );
  });

  it("returns updatedClassCount and cutoff as jsonb", () => {
    expect(sql).toMatch(
      /RETURN jsonb_build_object\('updatedClassCount', v_n, 'cutoff', v_cut\)/
    );
  });

  it("locks down execute to authenticated only", () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.set_class_series_teacher\(uuid, uuid\) FROM public, anon, service_role/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.set_class_series_teacher\(uuid, uuid\) TO authenticated/
    );
  });

  it("never touches day substitutions (class_sessions.assigned_teacher_id)", () => {
    // Strip comment lines: the header documents that day substitutions stay
    // untouched; the executable statements must not reference the table.
    const executable = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(executable).not.toMatch(/class_sessions/);
    expect(executable).not.toMatch(/assigned_teacher_id/);
  });
});
