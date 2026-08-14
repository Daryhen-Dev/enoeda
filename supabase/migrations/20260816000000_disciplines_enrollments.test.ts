/**
 * Disciplines & Enrollments Migration Test: Structural and contract validation
 * Verifies the migration SQL artifact contains all required disciplines,
 * enrollment, and event structures per the design document.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(
  __dirname,
  "20260816000000_disciplines_enrollments.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Disciplines & Enrollments Migration — Structural Validation", () => {
  describe("1. disciplines table", () => {
    it("creates the disciplines table", () => {
      expect(sql).toContain("CREATE TABLE public.disciplines");
    });

    it("has unique indexes on name and code (case-insensitive)", () => {
      expect(sql).toContain("disciplines_name_uq");
      expect(sql).toContain("disciplines_code_uq");
      expect(sql).toMatch(/disciplines_name_uq ON public\.disciplines \(lower\(name\)\)/);
      expect(sql).toMatch(/disciplines_code_uq ON public\.disciplines \(lower\(code\)\)/);
    });

    it("has is_active boolean column", () => {
      expect(sql).toMatch(/is_active\s+boolean\s+NOT NULL\s+DEFAULT true/);
    });
  });

  describe("2. student_disciplines table", () => {
    it("creates the student_disciplines table", () => {
      expect(sql).toContain("CREATE TABLE public.student_disciplines");
    });

    it("has student_id FK referencing students", () => {
      expect(sql).toMatch(
        /student_id\s+uuid\s+NOT NULL\s+REFERENCES public\.students\(id\)\s+ON DELETE CASCADE/
      );
    });

    it("has discipline_id FK referencing disciplines", () => {
      expect(sql).toMatch(
        /discipline_id\s+uuid\s+NOT NULL\s+REFERENCES public\.disciplines\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has unique constraint on (student_id, discipline_id)", () => {
      expect(sql).toContain("student_disciplines_pair_uq");
      expect(sql).toContain("UNIQUE (student_id, discipline_id)");
    });

    it("has enrolled_not_future check constraint", () => {
      expect(sql).toContain("student_disciplines_enrolled_not_future_ck");
      expect(sql).toMatch(/enrolled_at\s*<=\s*CURRENT_DATE/);
    });

    it("has indexes on student_id and discipline_id", () => {
      expect(sql).toContain("student_disciplines_student_id_idx");
      expect(sql).toContain("student_disciplines_discipline_id_idx");
    });
  });

  describe("3. discipline_events table", () => {
    it("creates the discipline_events table", () => {
      expect(sql).toContain("CREATE TABLE public.discipline_events");
    });

    it("has student_discipline_id FK", () => {
      expect(sql).toMatch(
        /student_discipline_id\s+uuid\s+NOT NULL\s+REFERENCES public\.student_disciplines\(id\)\s+ON DELETE CASCADE/
      );
    });

    it("has performed_by FK referencing auth.users", () => {
      expect(sql).toMatch(
        /performed_by\s+uuid\s+NOT NULL\s+REFERENCES auth\.users\(id\)\s+ON DELETE RESTRICT/
      );
    });

    it("has event_type CHECK constraint", () => {
      expect(sql).toContain("discipline_events_type_ck");
      expect(sql).toMatch(
        /event_type IN \('enrolled','suspended','reactivated'\)/
      );
    });

    it("has index on student_discipline_id", () => {
      expect(sql).toContain("discipline_events_student_discipline_id_idx");
    });
  });

  describe("4. updated_at triggers", () => {
    it("creates trigger on disciplines", () => {
      expect(sql).toContain("disciplines_updated_at");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.disciplines[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/
      );
    });

    it("creates trigger on student_disciplines", () => {
      expect(sql).toContain("student_disciplines_updated_at");
      expect(sql).toMatch(
        /BEFORE UPDATE ON public\.student_disciplines[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/
      );
    });
  });

  describe("5. private.student_branch_id helper", () => {
    it("creates the function", () => {
      expect(sql).toContain("private.student_branch_id");
    });

    it("accepts p_student_id uuid", () => {
      expect(sql).toMatch(/student_branch_id\(p_student_id uuid\)/);
    });

    it("returns uuid", () => {
      expect(sql).toMatch(/student_branch_id[\s\S]*?RETURNS uuid/);
    });

    it("selects branch_id from students", () => {
      expect(sql).toMatch(
        /student_branch_id[\s\S]*?SELECT branch_id FROM public\.students WHERE id = p_student_id/
      );
    });

    it("is SECURITY DEFINER with empty search_path", () => {
      expect(sql).toMatch(
        /student_branch_id[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/
      );
    });

    it("grants execute to authenticated only", () => {
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION private.student_branch_id(uuid) TO authenticated"
      );
    });
  });

  describe("6. RLS: disciplines", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.disciplines FORCE ROW LEVEL SECURITY");
    });

    it("creates authenticated read policy", () => {
      expect(sql).toContain("Authenticated read disciplines");
    });

    it("creates owner write policy", () => {
      expect(sql).toContain("Owner write disciplines");
      expect(sql).toMatch(
        /Owner write disciplines[\s\S]*?has_role\(auth\.uid\(\),\s*'owner'::public\.role_enum\)/
      );
    });
  });

  describe("7. RLS: student_disciplines", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.student_disciplines ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.student_disciplines FORCE ROW LEVEL SECURITY");
    });

    it("creates owner full access policy", () => {
      expect(sql).toContain("Owner full access on student_disciplines");
    });

    it("creates admin branch-scoped write policy using student_branch_id", () => {
      expect(sql).toContain("Admin branch-scoped write on student_disciplines");
      expect(sql).toMatch(
        /Admin branch-scoped write on student_disciplines[\s\S]*?has_branch_role[\s\S]*?student_branch_id\(student_id\)/
      );
    });

    it("creates admin global read policy", () => {
      expect(sql).toContain("Admin global read on student_disciplines");
      expect(sql).toMatch(
        /Admin global read on student_disciplines[\s\S]*?has_any_admin_role\(auth\.uid\(\)\)/
      );
    });

    it("creates teacher branch-scoped read policy", () => {
      expect(sql).toContain("Teacher branch-scoped read on student_disciplines");
      expect(sql).toMatch(
        /Teacher branch-scoped read on student_disciplines[\s\S]*?has_branch_role[\s\S]*?'teacher'::public\.role_enum[\s\S]*?student_branch_id\(student_id\)/
      );
    });
  });

  describe("8. RLS: discipline_events", () => {
    it("enables and forces RLS", () => {
      expect(sql).toContain("ALTER TABLE public.discipline_events ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("ALTER TABLE public.discipline_events FORCE ROW LEVEL SECURITY");
    });

    it("creates owner full access policy", () => {
      expect(sql).toContain("Owner full access on discipline_events");
    });

    it("creates admin branch-scoped write policy", () => {
      expect(sql).toContain("Admin branch-scoped write on discipline_events");
    });

    it("creates admin global read policy", () => {
      expect(sql).toContain("Admin global read on discipline_events");
    });

    it("creates teacher branch-scoped read policy", () => {
      expect(sql).toContain("Teacher branch-scoped read on discipline_events");
    });
  });

  describe("9. Grants", () => {
    it("revokes from anon on all three tables", () => {
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.disciplines FROM anon");
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.student_disciplines FROM anon");
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.discipline_events FROM anon");
    });

    it("grants CRUD to authenticated on all three tables", () => {
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplines TO authenticated");
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_disciplines TO authenticated");
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_events TO authenticated");
    });
  });

  describe("10. Seed catalog", () => {
    it("inserts Karate and Kickboxing", () => {
      expect(sql).toContain("'Karate'");
      expect(sql).toContain("'karate'");
      expect(sql).toContain("'Kickboxing'");
      expect(sql).toContain("'kickboxing'");
    });

    it("uses ON CONFLICT DO NOTHING for idempotency", () => {
      expect(sql).toContain("ON CONFLICT DO NOTHING");
    });
  });

  describe("Transactional safety", () => {
    it("wraps in BEGIN/COMMIT", () => {
      expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
      expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    });
  });
});
