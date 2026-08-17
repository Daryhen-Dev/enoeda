import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(__dirname, "20260825000000_user_profiles.sql");
const sql = readFileSync(migrationPath, "utf-8");

describe("User profiles migration — structural validation", () => {
  it("creates the canonical table without a branch_id", () => {
    expect(sql).toMatch(/CREATE TABLE public\.user_profiles[\s\S]*?user_id\s+uuid\s+PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(sql).not.toMatch(/CREATE TABLE public\.user_profiles[\s\S]*?branch_id/);
  });

  it("enforces canonical profile field constraints and updates timestamps", () => {
    expect(sql).toContain("user_profiles_first_name_len_ck");
    expect(sql).toContain("user_profiles_surname_len_ck");
    expect(sql).toContain("user_profiles_phone_len_ck");
    expect(sql).toMatch(/BEFORE UPDATE ON public\.user_profiles[\s\S]*?EXECUTE FUNCTION public\.set_updated_at\(\)/);
  });

  it("backfills canonical profiles from the branch roster without changing that roster", () => {
    expect(sql).toMatch(/INSERT INTO public\.user_profiles[\s\S]*?FROM public\.teacher_profiles[\s\S]*?ON CONFLICT \(user_id\) DO NOTHING/);
    expect(sql).not.toMatch(/DROP TABLE public\.teacher_profiles/);
  });

  it("enables forced RLS with Admin-or-Teacher self read and update policies", () => {
    expect(sql).toContain("ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("Admin or Teacher reads own user profile");
    expect(sql).toContain("Admin or Teacher updates own user profile");
    expect(sql).toMatch(/user_id = auth\.uid\(\)[\s\S]*?private\.has_role\(auth\.uid\(\), 'admin'::public\.role_enum\)[\s\S]*?private\.has_role\(auth\.uid\(\), 'teacher'::public\.role_enum\)/);
    expect(sql).not.toMatch(/ON public\.user_profiles FOR INSERT TO authenticated/);
  });

  it("provides only a restricted, self-bound setup RPC", () => {
    expect(sql).toMatch(/CREATE FUNCTION public\.ensure_own_user_profile\(\s*p_first_name text,\s*p_surname text,\s*p_phone text,\s*p_date_of_birth date\s*\)/);
    expect(sql).toMatch(/ensure_own_user_profile[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/);
    expect(sql).toMatch(/INSERT INTO public\.user_profiles[\s\S]*?VALUES \(\s*auth\.uid\(\)/);
    expect(sql).toContain("ON CONFLICT (user_id) DO NOTHING");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.ensure_own_user_profile(text, text, text, date) TO authenticated");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.ensure_own_user_profile(text, text, text, date) FROM public, anon, service_role");
  });

  it("is transactional", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
  });
});
