/** Default Teacher Reassignment Migration — SQL-text structural validation. No live DB. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const sql = readFileSync(resolve(__dirname, "20260828000000_default_teacher_reassignment.sql"), "utf-8");
const fnBlock = (name: string, len = 3000) => { const i = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}`); return sql.slice(i, i + len); };

describe("Default Teacher Reassignment Migration", () => {
  describe("1. branch_default_teachers", () => {
    it("creates with branch_id PK and teacher_id FK", () => {
      expect(sql).toContain("CREATE TABLE public.branch_default_teachers");
      expect(sql).toMatch(/branch_id\s+uuid\s+PRIMARY KEY/);
      expect(sql).toMatch(/teacher_id\s+uuid\s+NOT NULL\s+REFERENCES auth\.users\(id\)/);
    });
  });
  describe("2. teacher_attribution_periods", () => {
    it("creates with required columns and composite index", () => {
      expect(sql).toContain("CREATE TABLE public.teacher_attribution_periods");
      expect(sql).toMatch(/scheduled_class_id\s+uuid\s+NOT NULL\s+REFERENCES public\.scheduled_classes\(id\)/);
      expect(sql).toMatch(/effective_from\s+timestamptz\s+NOT NULL/);
      expect(sql).toMatch(/effective_until\s+timestamptz/);
      expect(sql).toContain("teacher_attribution_periods_class_from_idx");
    });
  });
  describe("3. resolve_effective_teacher", () => {
    it("is SECURITY DEFINER, returns uuid, uses America/Guayaquil", () => {
      const b = fnBlock("private.resolve_effective_teacher");
      expect(b).toMatch(/RETURNS uuid/);
      expect(b).toMatch(/SECURITY DEFINER/);
      expect(b).toMatch(/search_path\s*=\s*''/);
      expect(b).toContain("America/Guayaquil");
    });
    it("checks override → periods → default_teacher_id", () => {
      const b = fnBlock("private.resolve_effective_teacher");
      expect(b).toContain("assigned_teacher_id");
      expect(b).toContain("teacher_attribution_periods");
      expect(b).toContain("default_teacher_id");
    });
  });
  describe("4. is_session_teacher delegates", () => {
    it("calls resolve_effective_teacher", () => {
      expect(fnBlock("private.is_session_teacher", 500)).toContain("resolve_effective_teacher");
    });
  });
  describe("5. revoke_teacher_with_reassignment", () => {
    it("is SECURITY DEFINER, returns jsonb, granted to authenticated", () => {
      const b = fnBlock("public.revoke_teacher_with_reassignment", 5000);
      expect(b).toMatch(/RETURNS jsonb/);
      expect(b).toMatch(/SECURITY DEFINER/);
      expect(b).toMatch(/search_path\s*=\s*''/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.revoke_teacher_with_reassignment[\s\S]*?TO authenticated/);
    });
    it("calls revoke_branch_role internally", () => {
      expect(fnBlock("public.revoke_teacher_with_reassignment", 5000)).toContain("revoke_branch_role");
    });
    it("uses timestamp-based cutoff with scheduled_classes join for session reassignment", () => {
      const b = fnBlock("public.revoke_teacher_with_reassignment", 5000);
      const updateBlock = b.slice(b.indexOf("UPDATE public.class_sessions"));
      expect(updateBlock).toContain("FROM public.scheduled_classes");
      expect(updateBlock).toContain("AT TIME ZONE 'America/Guayaquil'");
      expect(updateBlock).toMatch(/session_date\s*\+\s*sc\.start_time/);
      expect(updateBlock).not.toContain("session_date>=v_cut::date");
      expect(updateBlock).not.toContain("session_date >= v_cut::date");
    });
  });
  describe("6. set_branch_default_teacher", () => {
    it("validates active same-branch teacher", () => {
      const b = fnBlock("public.set_branch_default_teacher");
      expect(b).toContain("user_roles");
      expect(b).toMatch(/revoked_at\s+IS\s+NULL/i);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_branch_default_teacher[\s\S]*?TO authenticated/);
    });
  });
  describe("7. RLS", () => {
    it("enables and forces RLS on both tables", () => {
      expect(sql).toContain("ALTER TABLE public.branch_default_teachers ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.branch_default_teachers FORCE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.teacher_attribution_periods ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.teacher_attribution_periods FORCE ROW LEVEL SECURITY");
    });
  });
  describe("8. Grants", () => {
    it("grants to authenticated", () => {
      expect(sql).toMatch(/GRANT\s+SELECT.*ON public\.branch_default_teachers TO authenticated/);
      expect(sql).toMatch(/GRANT\s+SELECT.*ON public\.teacher_attribution_periods TO authenticated/);
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION private.resolve_effective_teacher");
    });
  });
  describe("9. Baseline backfill", () => {
    it("uses scheduled_classes.created_at as effective_from", () => {
      const i = sql.indexOf("10. Baseline backfill");
      const b = sql.slice(i, i + 300);
      expect(b).toContain("INSERT INTO public.teacher_attribution_periods");
      expect(b).toContain("created_at");
      expect(b).toContain("scheduled_classes");
    });
  });
  describe("10. Transactional safety", () => {
    it("wraps in BEGIN/COMMIT", () => {
      expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
      expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    });
  });
});
