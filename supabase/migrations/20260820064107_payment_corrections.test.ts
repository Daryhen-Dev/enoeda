import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(__dirname, "20260820064107_payment_corrections.sql"),
  "utf8"
);

function functionBlock(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}`);
  return sql.slice(start, start + 5000);
}

describe("payment corrections migration", () => {
  it("is a transactional additive migration with settings defaults and checks", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toMatch(/payment_due_day smallint NOT NULL DEFAULT 5/);
    expect(sql).toMatch(/payment_edit_window_days smallint NOT NULL DEFAULT 3/);
    expect(sql).toContain("branches_payment_due_day_ck CHECK (payment_due_day BETWEEN 1 AND 31)");
    expect(sql).toContain("branches_payment_edit_window_days_ck CHECK (payment_edit_window_days BETWEEN 0 AND 365)");
  });

  it("protects 24-month half-open coverage and rejects overlaps", () => {
    expect(sql).toContain("payments_months_covered_ck CHECK (months_covered BETWEEN 1 AND 24)");
    expect(sql).toContain("payments_coverage_no_overlap");
    expect(sql).toContain("daterange(period_start, period_end, '[)') WITH &&");
    expect(sql).toContain("payments_student_discipline_period_idx");
  });

  it("replaces broad admin policies with scoped insert and correction policies", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Admin branch-scoped write on payments"');
    expect(sql).toContain('DROP POLICY IF EXISTS "Admin branch-scoped write on class_payments"');
    expect(sql).toContain('"Admin branch-scoped insert on payments"');
    expect(sql).toContain('"Admin correction update on payments"');
    expect(sql).toContain('"Admin correction delete on payments"');
    expect(sql).toMatch(/CREATE POLICY "Admin branch-scoped insert on class_payments" ON public\.class_payments FOR INSERT TO authenticated\s+WITH CHECK \(private\.active_branch_admin\(auth\.uid\(\), private\.student_discipline_branch_id\(student_discipline_id\)\)\)/);
    expect(sql).toContain('"Admin correction update on class_payments"');
    expect(sql).toContain('"Admin correction delete on class_payments"');
    expect(sql).not.toContain('DROP POLICY IF EXISTS "Owner read-only on payments"');
    expect(sql).not.toContain('CREATE POLICY "Teacher branch-scoped update on class_payments"');
    expect(sql).not.toContain('CREATE POLICY "Teacher branch-scoped delete on class_payments"');
  });

  it("uses active branch roles and the immutable created_at rolling window", () => {
    const block = functionBlock("private.payment_correction_allowed");
    expect(block).toContain("private.active_branch_admin");
    expect(block).toContain("clock_timestamp() <= p_created_at");
    expect(block).toContain("make_interval(days => b.payment_edit_window_days)");
    expect(block).toMatch(/SECURITY DEFINER SET search_path = ''/);
    expect(functionBlock("private.prevent_payment_identity_change")).toContain("NEW.created_at IS DISTINCT FROM OLD.created_at");
  });

  it("records immutable branch-scoped audit evidence for updates and deletes", () => {
    expect(sql).toContain("CREATE TABLE public.payment_audit_entries");
    expect(sql).toContain("CREATE TRIGGER payments_audit_updates");
    expect(sql).toContain("CREATE TRIGGER payments_audit_before_delete");
    expect(sql).toContain("CREATE TRIGGER class_payments_audit_updates");
    expect(sql).toContain("CREATE TRIGGER class_payments_audit_before_delete");
    expect(sql).toMatch(/CREATE TRIGGER payments_audit_before_delete\r?\n  BEFORE DELETE ON public\.payments/);
    expect(sql).toMatch(/CREATE TRIGGER class_payments_audit_before_delete\r?\n  BEFORE DELETE ON public\.class_payments/);
    const block = functionBlock("private.record_payment_audit");
    expect(block).toContain("private.student_discipline_branch_id");
    expect(block).toContain("to_jsonb(OLD)");
    expect(block).toContain("to_jsonb(NEW)");
    expect(block).toMatch(/SECURITY DEFINER SET search_path = ''/);
    expect(sql).toContain("REVOKE ALL ON public.payment_audit_entries FROM anon, authenticated");
    expect(sql).toMatch(/CREATE POLICY "Admin branch-scoped payment audit insert" ON public\.payment_audit_entries FOR INSERT TO authenticated\s+WITH CHECK \(private\.active_branch_admin\(auth\.uid\(\), branch_id\)\)/);
    expect(sql).toContain("GRANT SELECT ON public.payment_audit_entries TO authenticated");
    expect(sql).not.toContain("GRANT INSERT ON public.payment_audit_entries TO authenticated");
  });

  it("reconciles only the changed enrollment using the configured clamped due day", () => {
    const block = functionBlock("private.reconcile_payment_next_due_date");
    expect(block).toContain("min(period_start)");
    expect(block).toContain("ORDER BY period_start, period_end");
    expect(block).toContain("LEAST(v_due_day::integer, EXTRACT(DAY FROM v_last_day)::integer)");
    expect(block).not.toContain("UPDATE public.payments");
    expect(sql).toContain("CREATE TRIGGER payments_reconcile_next_due");
  });

  it("forces RLS and preserves authenticated table grants", () => {
    expect(sql).toContain("ALTER TABLE public.payments FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.class_payments FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.payment_audit_entries FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments, public.class_payments TO authenticated");
  });
});
