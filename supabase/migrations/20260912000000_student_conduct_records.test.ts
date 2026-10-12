/**
 * Structural test for migration 20260912000000_student_conduct_records.sql.
 *
 * Mirrors the structural-test style of 20260819000000_progress_and_notes.test.ts
 * and 20260911000000_class_series_teacher.test.ts: the SQL file is validated
 * textually (transactional shape, table/constraint/policy/grant/trigger
 * presence) since these migrations run against Supabase, not a local test DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "20260912000000_student_conduct_records.sql"
);

const sql = readFileSync(MIGRATION_PATH, "utf-8");

describe("20260912000000_student_conduct_records structural checks", () => {
  it("is transactional and contains no destructive statements", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
  });

  it("creates public.student_conduct_records with the expected columns", () => {
    expect(sql).toContain("CREATE TABLE public.student_conduct_records");
    expect(sql).toMatch(
      /student_id\s+uuid NOT NULL REFERENCES public\.students\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(/kind\s+text NOT NULL/);
    expect(sql).toMatch(/reason\s+text NOT NULL/);
    expect(sql).toMatch(/incident_date\s+date NOT NULL DEFAULT CURRENT_DATE/);
    expect(sql).toMatch(/amount\s+numeric\(10, 2\)/);
    expect(sql).toMatch(/status\s+text NOT NULL/);
    expect(sql).toMatch(/paid_at\s+timestamptz/);
    expect(sql).toMatch(/paid_by\s+uuid/);
    expect(sql).toMatch(/voided_at\s+timestamptz/);
    expect(sql).toMatch(/voided_by\s+uuid/);
    expect(sql).toMatch(/void_reason\s+text/);
    expect(sql).toMatch(
      /created_by\s+uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE RESTRICT/
    );
    expect(sql).toMatch(/created_at\s+timestamptz NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/updated_at\s+timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("restricts kind to fine|warning", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_kind_ck CHECK \(\s*kind IN \('fine', 'warning'\)\s*\)/
    );
  });

  it("bounds reason length between 1 and 2000", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_reason_len_ck CHECK \(char_length\(reason\) BETWEEN 1 AND 2000\)/
    );
  });

  it("keeps incident_date non-future", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_incident_not_future_ck CHECK \(incident_date <= CURRENT_DATE\)/
    );
  });

  it("requires an amount > 0 for fines and no amount for warnings", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_amount_ck CHECK \(\s*\(kind = 'fine' AND amount IS NOT NULL AND amount > 0\)\s+OR \(kind = 'warning' AND amount IS NULL\)\s*\)/
    );
  });

  it("ties the status set to kind: fines are pending|paid, warnings are issued", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_status_kind_ck CHECK \(\s*\(kind = 'fine' AND status IN \('pending', 'paid'\)\)\s+OR \(kind = 'warning' AND status = 'issued'\)\s*\)/
    );
  });

  it("enforces paid consistency: status='paid' iff paid_at and paid_by set, fines only", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_paid_consistency_ck CHECK \(\s*\(status = 'paid' AND kind = 'fine' AND paid_at IS NOT NULL AND paid_by IS NOT NULL\)\s+OR \(status <> 'paid' AND paid_at IS NULL AND paid_by IS NULL\)\s*\)/
    );
  });

  it("enforces void consistency: void columns all-null or all-set with reason 1..500", () => {
    expect(sql).toMatch(
      /CONSTRAINT student_conduct_records_void_consistency_ck CHECK \(\s*\(voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL\)\s+OR \(voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL\s+AND char_length\(void_reason\) BETWEEN 1 AND 500\)\s*\)/
    );
  });

  it("indexes (student_id, created_at desc) and pending non-voided fines", () => {
    expect(sql).toMatch(
      /CREATE INDEX student_conduct_records_student_created_idx\s+ON public\.student_conduct_records \(student_id, created_at DESC\);/
    );
    expect(sql).toMatch(
      /CREATE INDEX student_conduct_records_pending_fines_idx\s+ON public\.student_conduct_records \(student_id\)\s+WHERE kind = 'fine' AND status = 'pending' AND voided_at IS NULL;/
    );
  });

  it("maintains updated_at via the shared set_updated_at trigger", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER student_conduct_records_updated_at\s+BEFORE UPDATE ON public\.student_conduct_records\s+FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\);/
    );
  });

  it("guards updates: identity fields immutable, no un-void, no paying voided records, no un-paying", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.prevent_conduct_record_invalid_update\(\)/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'conduct record identity fields are immutable'/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'voided conduct records cannot be modified or un-voided'/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'paid fines cannot be reverted to pending'/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION 'voided conduct records cannot be paid'/
    );
    expect(sql).toMatch(
      /CREATE TRIGGER student_conduct_records_guard_update\s+BEFORE UPDATE ON public\.student_conduct_records\s+FOR EACH ROW EXECUTE FUNCTION private\.prevent_conduct_record_invalid_update\(\);/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION private\.prevent_conduct_record_invalid_update\(\) FROM public;/
    );
  });

  it("enables and forces RLS", () => {
    expect(sql).toContain(
      "ALTER TABLE public.student_conduct_records ENABLE ROW LEVEL SECURITY"
    );
    expect(sql).toContain(
      "ALTER TABLE public.student_conduct_records FORCE ROW LEVEL SECURITY"
    );
  });

  it("gives owner read-only access", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Owner read-only on student_conduct_records" ON public\.student_conduct_records\s+FOR SELECT TO authenticated\s+USING \(private\.has_role\(auth\.uid\(\), 'owner'::public\.role_enum\)\);/
    );
  });

  it("gives admin and teacher branch-scoped read", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Admin branch-scoped read on student_conduct_records" ON public\.student_conduct_records\s+FOR SELECT TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, private\.student_branch_id\(student_id\)\)\);/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Teacher branch-scoped read on student_conduct_records" ON public\.student_conduct_records\s+FOR SELECT TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, private\.student_branch_id\(student_id\)\)\);/
    );
  });

  it("lets the student read their own records via students.auth_user_id", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Student reads own conduct records" ON public\.student_conduct_records\s+FOR SELECT TO authenticated\s+USING \(EXISTS \(\s*SELECT 1 FROM public\.students\s+WHERE students\.id = student_conduct_records\.student_id\s+AND students\.auth_user_id = auth\.uid\(\)\s*\)\);/
    );
  });

  it("gives admin and teacher branch-scoped INSERT requiring created_by = auth.uid()", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Admin branch-scoped insert on student_conduct_records" ON public\.student_conduct_records\s+FOR INSERT TO authenticated\s+WITH CHECK \(\s*private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, private\.student_branch_id\(student_id\)\)\s+AND created_by = auth\.uid\(\)\s*\);/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Teacher branch-scoped insert on student_conduct_records" ON public\.student_conduct_records\s+FOR INSERT TO authenticated\s+WITH CHECK \(\s*private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, private\.student_branch_id\(student_id\)\)\s+AND created_by = auth\.uid\(\)\s*\);/
    );
  });

  it("gives admin and teacher branch-scoped UPDATE, and no INSERT/UPDATE to owner or student", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Admin branch-scoped update on student_conduct_records" ON public\.student_conduct_records\s+FOR UPDATE TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, private\.student_branch_id\(student_id\)\)\)\s+WITH CHECK \(private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, private\.student_branch_id\(student_id\)\)\);/
    );
    expect(sql).toMatch(
      /CREATE POLICY "Teacher branch-scoped update on student_conduct_records" ON public\.student_conduct_records\s+FOR UPDATE TO authenticated\s+USING \(private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, private\.student_branch_id\(student_id\)\)\)\s+WITH CHECK \(private\.has_branch_role\(auth\.uid\(\), 'teacher'::public\.role_enum, private\.student_branch_id\(student_id\)\)\);/
    );
    // Policies are scoped per action: no owner write, no student write.
    expect(sql).not.toMatch(/owner[\s\S]{0,200}FOR (INSERT|UPDATE)/i);
  });

  it("revokes everything from anon and grants authenticated only the needed privileges", () => {
    expect(sql).toContain(
      "REVOKE ALL ON public.student_conduct_records FROM anon;"
    );
    expect(sql).toContain(
      "REVOKE ALL ON public.student_conduct_records FROM authenticated;"
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT ON public.student_conduct_records TO authenticated;"
    );
    expect(sql).toMatch(
      /GRANT UPDATE \(status, paid_at, paid_by, voided_at, voided_by, void_reason, updated_at\)\s+ON public\.student_conduct_records TO authenticated;/
    );
    // No table-level or column-level DELETE for anyone.
    expect(sql).not.toMatch(/GRANT[^;]*\bDELETE\b/i);
  });

  it("documents the table", () => {
    expect(sql).toMatch(/COMMENT ON TABLE public\.student_conduct_records IS/);
  });
});
