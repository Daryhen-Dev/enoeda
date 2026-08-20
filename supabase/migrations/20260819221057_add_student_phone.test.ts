import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(__dirname, "20260819221057_add_student_phone.sql");
const sql = readFileSync(migrationPath, "utf-8");

describe("Student phone migration — structural validation", () => {
  it("adds a nullable phone column with a 30-character constraint", () => {
    expect(sql).toContain("ALTER TABLE public.students ADD COLUMN phone text;");
    expect(sql).toContain("students_phone_len_ck");
    expect(sql).toMatch(/CHECK \(phone IS NULL OR char_length\(phone\) <= 30\)/);
    expect(sql).not.toMatch(/phone\s+text\s+NOT NULL/);
  });
});
