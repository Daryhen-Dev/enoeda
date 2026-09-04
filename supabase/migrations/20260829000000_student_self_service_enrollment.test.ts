import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260829000000_student_self_service_enrollment.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Student self-service enrollment migration — structural validation", () => {
  it("adds a nullable, unique Auth-to-student association without changing staff roles", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.students\s+ADD COLUMN auth_user_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
    expect(sql).toContain("students_auth_user_id_uq UNIQUE (auth_user_id)");
    expect(sql).not.toMatch(/ALTER TYPE public\.role_enum[\s\S]*student/i);
    expect(sql).not.toMatch(/INSERT INTO public\.user_roles[\s\S]*student/i);
  });

  it("creates app-owned invitation state with a single Auth binding and explicit lifecycle fields", () => {
    expect(sql).toMatch(/CREATE TABLE public\.student_invitations[\s\S]*?email\s+text NOT NULL/);
    expect(sql).toMatch(/student_invitations[\s\S]*?auth_user_id\s+uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/);
    expect(sql).toMatch(/student_invitations[\s\S]*?branch_id\s+uuid NOT NULL REFERENCES public\.branches\(id\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/student_invitations[\s\S]*?student_id\s+uuid UNIQUE REFERENCES public\.students\(id\) ON DELETE RESTRICT/);
    expect(sql).toContain("student_invitations_state_ck");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'accepted'");
    expect(sql).toContain("'revoked'");
    expect(sql).toContain("'needs_review'");
    expect(sql).toContain("expires_at");
    expect(sql).toContain("password_set_at");
    expect(sql).toContain("accepted_at");
    expect(sql).toContain("revoked_at");
    expect(sql).toContain("student_invitations_auth_user_id_uq");
  });

  it("derives an explicit expired state from the seven-day application expiry", () => {
    expect(sql).toMatch(/CREATE FUNCTION private\.student_invitation_state\([\s\S]*?p_state = 'pending'[\s\S]*?p_expires_at <= now\(\)[\s\S]*?'expired'/);
    expect(sql).toMatch(/expires_at[\s\S]*?interval '7 days'/);
  });

  it("keeps student invitations read-only for authenticated callers", () => {
    expect(sql).toContain("ALTER TABLE public.student_invitations ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.student_invitations FORCE ROW LEVEL SECURITY");
    expect(sql).toMatch(/CREATE POLICY "Branch admins list student invitations"[\s\S]*?private\.has_branch_role\(auth\.uid\(\), 'admin'::public\.role_enum, branch_id\)/);
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.student_invitations FROM anon, authenticated"
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.student_invitations TO authenticated"
    );
    expect(sql).not.toMatch(
      /ON public\.student_invitations FOR (?:INSERT|UPDATE) TO authenticated/
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:ALL|[^;]*(?:INSERT|UPDATE))\s+ON TABLE public\.student_invitations\s+TO authenticated/
    );
    expect(sql).not.toMatch(/CREATE POLICY "Teacher[^"]*student invitations"/);
  });

  it("allows a linked student to read only their profile and exposes a phone-only update RPC", () => {
    expect(sql).toMatch(/CREATE POLICY "Student reads own profile"[\s\S]*?auth_user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/CREATE FUNCTION public\.update_own_student_phone\(p_phone text\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/);
    expect(sql).toMatch(/UPDATE public\.students\s+SET phone = NULLIF\(btrim\(p_phone\), ''\)/);
    expect(sql).not.toMatch(/update_own_student_phone[\s\S]*?SET[\s\S]*?(first_name|surname|national_id|email|date_of_birth)/);
  });

  it("keeps enrollment completion self-bound, one-use, conflict-safe, and free of v1 enrollment writes", () => {
    expect(sql).toMatch(/CREATE FUNCTION public\.complete_student_enrollment\([\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/);
    expect(sql).toMatch(/WHERE invitation\.auth_user_id = auth\.uid\(\)[\s\S]*?FOR UPDATE/);
    expect(sql).toMatch(/UPDATE public\.student_invitations[\s\S]*?state = 'needs_review'/);
    expect(sql).toMatch(/UPDATE public\.student_invitations[\s\S]*?state = 'accepted'/);
    expect(sql).toMatch(/INSERT INTO public\.students[\s\S]*?auth_user_id/);
    expect(sql).toMatch(/WHEN unique_violation[\s\S]*?state = 'needs_review'/);
    expect(sql).not.toMatch(/complete_student_enrollment[\s\S]*?(student_disciplines|student_progress|discipline_events|attendance)/);
  });

  it("restricts all student-facing RPCs to authenticated callers", () => {
    for (const functionName of [
      "get_my_student_enrollment_state",
      "mark_student_invitation_password_set",
      "complete_student_enrollment",
      "update_own_student_phone",
    ]) {
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${functionName}`
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${functionName}`
      );
    }
  });

  it("is transactional", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
  });
});
