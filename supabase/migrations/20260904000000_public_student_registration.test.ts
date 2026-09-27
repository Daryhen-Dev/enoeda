import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260904000000_public_student_registration.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Public student registration migration — structural validation", () => {
  it("keeps Auth linkage and adds a separate pending activation state", () => {
    expect(sql).toContain("ADD COLUMN activation_status text NOT NULL DEFAULT 'active'");
    expect(sql).toContain("students_activation_status_ck");
    expect(sql).toMatch(/activation_status IN \('pending', 'active'\)/);
    expect(sql).not.toMatch(/DROP COLUMN auth_user_id/);
  });

  it("enforces normalized student email uniqueness without silently changing records", () => {
    expect(sql).toMatch(/GROUP BY lower\(email\)[\s\S]*?HAVING count\(\*\) > 1/);
    expect(sql).toContain("CREATE UNIQUE INDEX students_email_normalized_uq");
    expect(sql).toContain("ON public.students (lower(email))");
  });

  it("keeps replay and rate-limit records private and service-role callable only", () => {
    expect(sql).toContain("CREATE TABLE private.public_registration_altcha_nonces");
    expect(sql).toContain("CREATE TABLE private.public_registration_rate_limits");
    expect(sql).toContain("REVOKE ALL ON TABLE private.public_registration_altcha_nonces");
    expect(sql).toContain("REVOKE ALL ON TABLE private.public_registration_rate_limits");
    expect(sql).toMatch(/CREATE FUNCTION public\.claim_public_student_registration_altcha_nonce[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/);
    expect(sql).toMatch(/CREATE FUNCTION public\.consume_public_student_registration_rate_limit[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_public_student_registration_altcha_nonce\(text, timestamptz\)\r?\n\s*TO service_role/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_public_student_registration_rate_limit\(text, text, integer, integer\)\r?\n\s*TO service_role/);
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]*?TO (?:anon|authenticated)/);
  });

  it("removes only unlinked invitation Auth users before retiring invitation artifacts", () => {
    expect(sql).toMatch(/DELETE FROM auth\.users AS auth_user[\s\S]*?invitation\.student_id IS NULL[\s\S]*?student\.auth_user_id = auth_user\.id/);
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.get_my_student_enrollment_state()");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.mark_student_invitation_password_set()");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.complete_student_enrollment(text, text, text, date, text)");
    expect(sql).toContain("DROP TABLE public.student_invitations");
    expect(sql).not.toContain("DROP FUNCTION public.update_own_student_phone");
  });

  it("is transactional", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
  });
});
