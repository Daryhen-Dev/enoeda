/**
 * U3 Migration Test: Branches + Students SQL contract validation
 * Verifies the migration SQL artifact is well-formed and contains required structures.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(
  __dirname,
  "20260812000000_branches_students.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("U3 Migration — Structural Validation", () => {
  it("creates branches table", () => {
    expect(sql).toContain("create table public.branches");
  });

  it("creates students table", () => {
    expect(sql).toContain("create table public.students");
  });

  it("students references branches via FK", () => {
    expect(sql).toContain("references public.branches(id)");
  });

  it("enforces globally unique national_id index", () => {
    expect(sql).toContain("students_national_id_uq");
    expect(sql).toContain("(national_id)");
  });

  it("enables RLS on branches", () => {
    expect(sql).toContain(
      "alter table public.branches enable row level security"
    );
    expect(sql).toContain(
      "alter table public.branches force row level security"
    );
  });

  it("enables RLS on students", () => {
    expect(sql).toContain(
      "alter table public.students enable row level security"
    );
    expect(sql).toContain(
      "alter table public.students force row level security"
    );
  });

  it("Admin has full access policies", () => {
    expect(sql).toContain("Admin full access on branches");
    expect(sql).toContain("Admin full access on students");
  });

  it("Teacher has read-only policies", () => {
    expect(sql).toContain("Teacher read branches");
    expect(sql).toContain("Teacher read students");
  });

  it("uses private.has_role for policy checks", () => {
    const hasRoleMatches = sql.match(/private\.has_role/g);
    expect(hasRoleMatches).not.toBeNull();
    // At least 4 usages: admin branches (using/with_check), teacher branches, admin students (using/with_check), teacher students
    expect(hasRoleMatches!.length).toBeGreaterThanOrEqual(4);
  });

  it("includes updated_at trigger for both tables", () => {
    expect(sql).toContain("branches_updated_at");
    expect(sql).toContain("students_updated_at");
  });

  it("students has required columns per spec", () => {
    const requiredColumns = [
      "branch_id",
      "first_name",
      "surname",
      "national_id",
      "email",
      "date_of_birth",
      "is_active",
    ];
    for (const col of requiredColumns) {
      expect(sql, `Missing column: ${col}`).toContain(col);
    }
  });

  it("does not use prisma migrate", () => {
    expect(sql.toLowerCase()).not.toContain("prisma");
  });

  it("includes time_zone column with NOT NULL default", () => {
    expect(sql).toContain("time_zone text not null default 'America/Guayaquil'");
  });

  it("enforces CHECK constraint limiting time zones to Ecuador IANA zones", () => {
    expect(sql).toContain("branches_time_zone_ck");
    expect(sql).toContain("America/Guayaquil");
    expect(sql).toContain("Pacific/Galapagos");
  });

  it("revokes anon DML on both tables", () => {
    expect(sql).toContain("revoke insert, update, delete on public.branches from anon");
    expect(sql).toContain("revoke insert, update, delete on public.students from anon");
  });
});
