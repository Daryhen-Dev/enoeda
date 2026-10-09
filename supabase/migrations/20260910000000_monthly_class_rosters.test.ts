import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260910000000_monthly_class_rosters.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Monthly class rosters migration — structural validation", () => {
  it("drops the scheduled_classes overlap restriction", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.scheduled_classes DROP CONSTRAINT scheduled_classes_no_overlap;/
    );
    // one_time_classes keeps its own anti-overlap exclusion
    expect(sql).not.toMatch(/one_time_classes_no_overlap/);
  });

  it("rewrites revoke_teacher_with_reassignment without the teacher-conflict scan", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.revoke_teacher_with_reassignment\(\s+p_target_user_id uuid, p_branch_id uuid\s+\) RETURNS jsonb/
    );
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.revoke_teacher_with_reassignment\(uuid, uuid\) FROM public, anon, service_role/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.revoke_teacher_with_reassignment\(uuid, uuid\) TO authenticated/);
    // Keeps both legitimate blocked reasons...
    expect(sql).toMatch(/'no_default_teacher'/);
    expect(sql).toMatch(/'revoked_is_default'/);
    // ...and drops the conflict scan and its blocked return entirely.
    expect(sql).not.toMatch(/'conflict'/);
    expect(sql).not.toMatch(/class_time_range/);
  });

  it("adds the monthly-group columns to class_series with checks and lineage index", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.class_series\s+ADD COLUMN discipline_id uuid NOT NULL REFERENCES public\.disciplines\(id\) ON DELETE RESTRICT,\s+ADD COLUMN default_teacher_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL,\s+ADD COLUMN period_month date NOT NULL,\s+ADD COLUMN cloned_from_series_id uuid REFERENCES public\.class_series\(id\) ON DELETE SET NULL,\s+ADD COLUMN is_active boolean NOT NULL DEFAULT true,\s+ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now\(\),\s+ADD CONSTRAINT class_series_period_month_start_of_month_ck\s+CHECK \(period_month = date_trunc\('month', period_month\)::date\),\s+ADD CONSTRAINT class_series_id_branch_discipline_uq\s+UNIQUE \(id, branch_id, discipline_id\)/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX class_series_cloned_from_series_id_uq\s+ON public\.class_series \(cloned_from_series_id\)\s+WHERE cloned_from_series_id IS NOT NULL/
    );
    expect(sql).toMatch(
      /CREATE INDEX class_series_branch_period_month_idx\s+ON public\.class_series \(branch_id, period_month\)/
    );
    expect(sql).toMatch(
      /CREATE INDEX class_series_discipline_id_idx\s+ON public\.class_series \(discipline_id\)/
    );
    expect(sql).toMatch(
      /CREATE TRIGGER class_series_updated_at\s+BEFORE UPDATE ON public\.class_series\s+FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\)/
    );
  });

  it("makes scheduled_classes.series_id NOT NULL with a composite FK into the group", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.scheduled_classes\s+DROP CONSTRAINT scheduled_classes_series_id_fkey,\s+ALTER COLUMN series_id SET NOT NULL,\s+ADD CONSTRAINT scheduled_classes_series_id_fkey\s+FOREIGN KEY \(series_id, branch_id, discipline_id\)\s+REFERENCES public\.class_series \(id, branch_id, discipline_id\)\s+ON DELETE CASCADE/
    );
  });

  it("adds student_disciplines.billing_mode with a closed value check", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.student_disciplines\s+ADD COLUMN billing_mode text NOT NULL DEFAULT 'monthly',\s+ADD CONSTRAINT student_disciplines_billing_mode_ck\s+CHECK \(billing_mode IN \('monthly','per_class'\)\)/
    );
  });

  it("creates both roster tables with cascade FKs and per-class uniqueness", () => {
    expect(sql).toMatch(
      /CREATE TABLE public\.class_series_students \(\s+id\s+uuid PRIMARY KEY DEFAULT gen_random_uuid\(\),\s+series_id\s+uuid NOT NULL REFERENCES public\.class_series\(id\) ON DELETE CASCADE,\s+student_id\s+uuid NOT NULL REFERENCES public\.students\(id\) ON DELETE CASCADE,\s+added_by\s+uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL,\s+created_at timestamptz NOT NULL DEFAULT now\(\),\s+CONSTRAINT class_series_students_series_student_uq UNIQUE \(series_id, student_id\)\s+\);/
    );
    expect(sql).toMatch(
      /CREATE INDEX class_series_students_student_id_idx\s+ON public\.class_series_students \(student_id\)/
    );
    expect(sql).toMatch(
      /CREATE TABLE public\.one_time_class_students \(\s+id\s+uuid PRIMARY KEY DEFAULT gen_random_uuid\(\),\s+one_time_class_id\s+uuid NOT NULL REFERENCES public\.one_time_classes\(id\) ON DELETE CASCADE,\s+student_id\s+uuid NOT NULL REFERENCES public\.students\(id\) ON DELETE CASCADE,\s+added_by\s+uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL,\s+created_at timestamptz NOT NULL DEFAULT now\(\),\s+CONSTRAINT one_time_class_students_class_student_uq UNIQUE \(one_time_class_id, student_id\)\s+\);/
    );
    expect(sql).toMatch(
      /CREATE INDEX one_time_class_students_student_id_idx\s+ON public\.one_time_class_students \(student_id\)/
    );
  });

  it("adds SECURITY DEFINER branch helpers with locked search_path", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.class_series_branch_id\(p_series_id uuid\)\s+RETURNS uuid\s+LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''/
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.one_time_class_branch_id\(p_one_time_class_id uuid\)\s+RETURNS uuid\s+LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''/
    );
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION private\.class_series_branch_id\(uuid\) FROM public/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION private\.class_series_branch_id\(uuid\) TO authenticated/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION private\.one_time_class_branch_id\(uuid\) FROM public/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION private\.one_time_class_branch_id\(uuid\) TO authenticated/);
  });

  it("adds eligibility triggers with stable error message prefixes", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.assert_roster_eligibility\(\s+p_branch_id uuid, p_discipline_id uuid, p_student_id uuid\s+\) RETURNS void\s+LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''/
    );
    expect(sql).toMatch(/RAISE EXCEPTION 'roster_student_branch_mismatch:/);
    expect(sql).toMatch(/RAISE EXCEPTION 'roster_student_inactive:/);
    expect(sql).toMatch(/RAISE EXCEPTION 'roster_student_not_eligible:/);
    expect(sql).toMatch(/sd\.billing_mode = 'monthly'/);
    expect(sql).toMatch(
      /CREATE TRIGGER class_series_students_eligibility\s+BEFORE INSERT OR UPDATE ON public\.class_series_students\s+FOR EACH ROW EXECUTE FUNCTION private\.class_series_students_eligibility\(\)/
    );
    expect(sql).toMatch(
      /CREATE TRIGGER one_time_class_students_eligibility\s+BEFORE INSERT OR UPDATE ON public\.one_time_class_students\s+FOR EACH ROW EXECUTE FUNCTION private\.one_time_class_students_eligibility\(\)/
    );
  });

  it("enables and forces RLS on both roster tables with owner/admin/teacher policies", () => {
    for (const table of ["class_series_students", "one_time_class_students"]) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)
      );
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`)
      );
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY "Owner full access on ${table}"\\s+ON public\\.${table} FOR ALL TO authenticated\\s+USING \\(private\\.has_role\\(auth\\.uid\\(\\), 'owner'::public\\.role_enum\\)\\)\\s+WITH CHECK \\(private\\.has_role\\(auth\\.uid\\(\\), 'owner'::public\\.role_enum\\)\\)`
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY "Admin branch-scoped write on ${table}"\\s+ON public\\.${table} FOR ALL TO authenticated\\s+USING \\(private\\.has_branch_role\\(auth\\.uid\\(\\), 'admin'::public\\.role_enum,\\s+private\\.(class_series_branch_id|one_time_class_branch_id)\\(`
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY "Admin global read on ${table}"\\s+ON public\\.${table} FOR SELECT TO authenticated\\s+USING \\(private\\.has_any_admin_role\\(auth\\.uid\\(\\)\\)\\)`
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY "Teacher branch-scoped read on ${table}"\\s+ON public\\.${table} FOR SELECT TO authenticated\\s+USING \\(private\\.has_branch_role\\(auth\\.uid\\(\\), 'teacher'::public\\.role_enum,\\s+private\\.(class_series_branch_id|one_time_class_branch_id)\\(`
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `REVOKE INSERT, UPDATE, DELETE ON public\\.${table} FROM anon`
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${table} TO authenticated`
        )
      );
    }
  });

  it("is transactional and destructive statements are limited to the two intentional constraint drops", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|POLICY|FUNCTION)\b/i);
    // The only allowed DROP CONSTRAINT statements: the overlap restriction
    // and the replaced single-column series FK.
    const dropConstraints = sql.match(/DROP CONSTRAINT \w+/g) ?? [];
    expect(dropConstraints).toHaveLength(2);
    expect(dropConstraints).toContain("DROP CONSTRAINT scheduled_classes_no_overlap");
    expect(dropConstraints).toContain("DROP CONSTRAINT scheduled_classes_series_id_fkey");
  });
});
