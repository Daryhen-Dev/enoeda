/**
 * Scheduled Classes & Sessions Migration Test: Structural and contract validation
 * Verifies the migration SQL artifact contains all required DDL for scheduled_classes,
 * class_sessions, exclusion constraint, RLS, triggers, and helper function.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(
  __dirname,
  "20260817000000_scheduled_classes_sessions.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Scheduled Classes & Sessions Migration — Structural Validation", () => {
  describe("0. Extensions and types", () => {
    it("creates btree_gist extension", () => {
      expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist");
    });

    it("creates class_time_range type", () => {
      expect(sql).toContain("CREATE TYPE public.class_time_range AS RANGE");
      expect(sql).toContain("subtype = time");
    });
  });

  describe("1. scheduled_classes table", () => {
    it("creates the scheduled_classes table", () => {
      expect(sql).toContain("CREATE TABLE public.scheduled_classes");
    });

    it("has branch_id FK with ON DELETE CASCADE", () => {
      expect(sql).toMatch(
        /branch_id\s+uuid\s+NOT NULL\s+REFERENCES public\.branches\(id\)\s+ON DELETE CASCADE/
      );
    });

    it("has discipline_id FK with ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /discipline_id\s+uuid\s+NOT NULL\s+REFERENCES public\.disciplines\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has default_teacher_id FK with ON DELETE SET NULL", () => {
      expect(sql).toMatch(
        /default_teacher_id\s+uuid\s+REFERENCES auth\.users\(id\)\s+ON DELETE SET NULL/
      );
    });

    it("has day_of_week CHECK constraint (0-6)", () => {
      expect(sql).toMatch(/day_of_week\s+smallint\s+NOT NULL\s+CHECK\s*\(day_of_week BETWEEN 0 AND 6\)/);
    });

    it("has EXCLUDE USING gist constraint for anti-overlap", () => {
      expect(sql).toContain("EXCLUDE USING gist");
      expect(sql).toContain("scheduled_classes_no_overlap");
      expect(sql).toContain("public.class_time_range");
    });

    it("has indexes on branch_id, discipline_id, and teacher_id", () => {
      expect(sql).toContain("scheduled_classes_branch_id_idx");
      expect(sql).toContain("scheduled_classes_discipline_id_idx");
      expect(sql).toContain("scheduled_classes_teacher_id_idx");
    });
  });

  describe("2. class_sessions table", () => {
    it("creates the class_sessions table", () => {
      expect(sql).toContain("CREATE TABLE public.class_sessions");
    });

    it("has scheduled_class_id FK with ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /scheduled_class_id\s+uuid\s+NOT NULL\s+REFERENCES public\.scheduled_classes\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has assigned_teacher_id FK with ON DELETE SET NULL", () => {
      expect(sql).toMatch(
        /assigned_teacher_id\s+uuid\s+REFERENCES auth\.users\(id\)\s+ON DELETE SET NULL/
      );
    });

    it("has unique constraint on (scheduled_class_id, session_date)", () => {
      expect(sql).toContain("class_sessions_pair_uq");
    });

    it("has chk_suspended_has_category CHECK constraint", () => {
      expect(sql).toContain("chk_suspended_has_category");
      expect(sql).toMatch(/status <> 'suspended' OR suspension_category IS NOT NULL/);
    });

    it("has chk_otro_has_reason CHECK constraint", () => {
      expect(sql).toContain("chk_otro_has_reason");
      expect(sql).toMatch(/suspension_category <> 'otro' OR suspension_reason IS NOT NULL/);
    });

    it("has chk_scheduled_no_suspension CHECK constraint", () => {
      expect(sql).toContain("chk_scheduled_no_suspension");
      expect(sql).toMatch(
        /status <> 'scheduled' OR \(suspension_category IS NULL AND suspension_reason IS NULL\)/
      );
    });

    it("has status_date composite index", () => {
      expect(sql).toContain("class_sessions_status_date_idx");
    });

    it("has indexes on scheduled_class_id and assigned_teacher_id", () => {
      expect(sql).toContain("class_sessions_scheduled_class_id_idx");
      expect(sql).toContain("class_sessions_teacher_id_idx");
    });
  });

  describe("3. updated_at triggers", () => {
    it("creates trigger on scheduled_classes", () => {
      expect(sql).toContain("scheduled_classes_updated_at");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.scheduled_classes[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/
      );
    });

    it("creates trigger on class_sessions", () => {
      expect(sql).toContain("class_sessions_updated_at");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.class_sessions[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/
      );
    });
  });

  describe("4. private.scheduled_class_branch_id helper", () => {
    it("creates the function", () => {
      expect(sql).toContain("private.scheduled_class_branch_id");
    });

    it("accepts p_scheduled_class_id uuid", () => {
      expect(sql).toMatch(/scheduled_class_branch_id\(p_scheduled_class_id uuid\)/);
    });

    it("returns uuid", () => {
      expect(sql).toMatch(/scheduled_class_branch_id[\s\S]*?RETURNS uuid/);
    });

    it("selects branch_id from scheduled_classes", () => {
      expect(sql).toMatch(
        /scheduled_class_branch_id[\s\S]*?SELECT branch_id FROM public\.scheduled_classes WHERE id = p_scheduled_class_id/
      );
    });

    it("is SECURITY DEFINER with empty search_path", () => {
      expect(sql).toMatch(
        /scheduled_class_branch_id[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/
      );
    });

    it("grants execute to authenticated only", () => {
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION private.scheduled_class_branch_id(uuid) TO authenticated"
      );
    });
  });

  describe("5. RLS: scheduled_classes", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.scheduled_classes ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.scheduled_classes FORCE ROW LEVEL SECURITY");
    });

    it("creates owner full access policy", () => {
      expect(sql).toContain("Owner full access on scheduled_classes");
    });

    it("creates admin branch-scoped write policy", () => {
      expect(sql).toContain("Admin branch-scoped write on scheduled_classes");
    });

    it("creates admin global read policy", () => {
      expect(sql).toContain("Admin global read on scheduled_classes");
    });

    it("creates teacher branch-scoped read policy", () => {
      expect(sql).toContain("Teacher branch-scoped read on scheduled_classes");
    });
  });

  describe("6. RLS: class_sessions", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.class_sessions FORCE ROW LEVEL SECURITY");
    });

    it("creates owner full access policy", () => {
      expect(sql).toContain("Owner full access on class_sessions");
    });

    it("creates admin branch-scoped write policy using scheduled_class_branch_id", () => {
      expect(sql).toContain("Admin branch-scoped write on class_sessions");
      expect(sql).toMatch(
        /Admin branch-scoped write on class_sessions[\s\S]*?scheduled_class_branch_id\(scheduled_class_id\)/
      );
    });

    it("creates admin global read policy", () => {
      expect(sql).toContain("Admin global read on class_sessions");
    });

    it("creates teacher branch-scoped read policy", () => {
      expect(sql).toContain("Teacher branch-scoped read on class_sessions");
      expect(sql).toMatch(
        /Teacher branch-scoped read on class_sessions[\s\S]*?scheduled_class_branch_id\(scheduled_class_id\)/
      );
    });
  });

  describe("7. Grants", () => {
    it("revokes from anon on both tables", () => {
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.scheduled_classes FROM anon");
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.class_sessions FROM anon");
    });

    it("grants CRUD to authenticated on both tables", () => {
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_classes TO authenticated");
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated");
    });
  });

  describe("Transactional safety", () => {
    it("wraps in BEGIN/COMMIT", () => {
      expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
      expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    });
  });
});
