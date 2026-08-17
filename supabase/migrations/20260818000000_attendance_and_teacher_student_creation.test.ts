/**
 * Attendance & Teacher Student-Creation Migration Test: Structural validation
 * Verifies the migration SQL artifact contains all required DDL for attendance table,
 * indexes, trigger, helper functions, RLS policies, and teacher INSERT policies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(
  __dirname,
  "20260818000000_attendance_and_teacher_student_creation.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Attendance & Teacher Student-Creation Migration — Structural Validation", () => {
  describe("1. attendance table", () => {
    it("creates the attendance table", () => {
      expect(sql).toContain("CREATE TABLE public.attendance");
    });

    it("has scheduled_class_id FK with ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /scheduled_class_id\s+uuid\s+NOT NULL\s+REFERENCES public\.scheduled_classes\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has student_id FK with ON DELETE CASCADE", () => {
      expect(sql).toMatch(
        /student_id\s+uuid\s+NOT NULL\s+REFERENCES public\.students\(id\)\s+ON DELETE CASCADE/
      );
    });

    it("has marked_by FK with ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /marked_by\s+uuid\s+NOT NULL\s+REFERENCES auth\.users\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has unique constraint on (scheduled_class_id, session_date, student_id)", () => {
      expect(sql).toContain("attendance_session_student_uq");
    });

    it("has observation length CHECK constraint", () => {
      expect(sql).toContain("attendance_observation_len_ck");
      expect(sql).toContain("char_length(observation) <= 500");
    });
  });

  describe("2. Indexes", () => {
    it("has index on scheduled_class_id", () => {
      expect(sql).toContain("attendance_scheduled_class_id_idx");
    });

    it("has index on student_id", () => {
      expect(sql).toContain("attendance_student_id_idx");
    });

    it("has index on session_date", () => {
      expect(sql).toContain("attendance_session_date_idx");
    });

    it("has composite index on (scheduled_class_id, session_date)", () => {
      expect(sql).toContain("attendance_class_date_idx");
    });
  });

  describe("3. updated_at trigger", () => {
    it("creates trigger on attendance", () => {
      expect(sql).toContain("attendance_updated_at");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.attendance[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/
      );
    });
  });

  describe("4. private.is_session_teacher helper", () => {
    it("creates the function with correct signature", () => {
      expect(sql).toContain("private.is_session_teacher");
      expect(sql).toMatch(
        /is_session_teacher\(\s*p_user_id uuid, p_scheduled_class_id uuid, p_session_date date\s*\)/
      );
    });

    it("returns boolean", () => {
      expect(sql).toMatch(/is_session_teacher[\s\S]*?RETURNS boolean/);
    });

    it("is SECURITY DEFINER with empty search_path", () => {
      expect(sql).toMatch(
        /is_session_teacher[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/
      );
    });

    it("grants execute to authenticated only", () => {
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION private.is_session_teacher(uuid, uuid, date) TO authenticated"
      );
    });
  });

  describe("5. private.is_session_suspended helper", () => {
    it("creates the function with correct signature", () => {
      expect(sql).toContain("private.is_session_suspended");
      expect(sql).toMatch(
        /is_session_suspended\(\s*p_scheduled_class_id uuid, p_session_date date\s*\)/
      );
    });

    it("returns boolean", () => {
      expect(sql).toMatch(/is_session_suspended[\s\S]*?RETURNS boolean/);
    });

    it("is SECURITY DEFINER with empty search_path", () => {
      expect(sql).toMatch(
        /is_session_suspended[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/
      );
    });

    it("grants execute to authenticated only", () => {
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION private.is_session_suspended(uuid, date) TO authenticated"
      );
    });
  });

  describe("6. RLS: attendance", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY");
    });

    it("creates owner read-only policy", () => {
      expect(sql).toContain("Owner read-only on attendance");
    });

    it("creates admin branch-scoped write policy", () => {
      expect(sql).toContain("Admin branch-scoped write on attendance");
    });

    it("creates teacher assigned-class write policy", () => {
      expect(sql).toContain("Teacher assigned-class write on attendance");
    });
  });

  describe("7. Teacher INSERT policies (D6)", () => {
    it("creates teacher insert policy on students", () => {
      expect(sql).toContain("Teacher branch-scoped insert on students");
    });

    it("creates teacher insert policy on student_disciplines", () => {
      expect(sql).toContain("Teacher branch-scoped insert on student_disciplines");
    });
  });

  describe("8. Grants", () => {
    it("revokes from anon on attendance", () => {
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.attendance FROM anon");
    });

    it("grants CRUD to authenticated on attendance", () => {
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated");
    });
  });

  describe("Transactional safety", () => {
    it("wraps in BEGIN/COMMIT", () => {
      expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
      expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    });
  });
});
