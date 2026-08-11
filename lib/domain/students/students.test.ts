/**
 * U3-S1 Domain Tests: Student Zod 4 validation contract.
 * Compact focused suite — no DB, no actions.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { studentCreateSchema, studentUpdateSchema } from "./schema";

const UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const base = {
  branch_id: UUID,
  first_name: "Juan",
  surname: "Pérez",
  national_id: "12345678",
  email: "juan@example.com",
  date_of_birth: "1995-03-15",
} as const;

describe("studentCreateSchema", () => {
  it("accepts valid input and defaults is_active to true", () => {
    const r = studentCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.is_active).toBe(true);
  });

  it.each([
    ["branch_id missing", { ...base, branch_id: undefined }],
    ["branch_id bad UUID", { ...base, branch_id: "nope" }],
    ["first_name empty", { ...base, first_name: "" }],
    ["surname empty", { ...base, surname: "" }],
    ["national_id empty", { ...base, national_id: "" }],
    ["first_name > 100", { ...base, first_name: "a".repeat(101) }],
    ["surname > 100", { ...base, surname: "a".repeat(101) }],
    ["national_id > 30", { ...base, national_id: "x".repeat(31) }],
    ["email invalid", { ...base, email: "not-an-email" }],
    ["date bad format", { ...base, date_of_birth: "01/15/1995" }],
  ])("rejects %s", (_label, input) => {
    expect(studentCreateSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["Feb 30", "2000-02-30"],
    ["Apr 31", "2023-04-31"],
    ["month 13", "2000-13-01"],
    ["day 0", "2000-01-00"],
    ["Feb 29 non-leap", "2023-02-29"],
  ])("rejects impossible date: %s", (_label, dob) => {
    expect(studentCreateSchema.safeParse({ ...base, date_of_birth: dob }).success).toBe(false);
  });

  it("accepts Feb 29 on leap year", () => {
    expect(
      studentCreateSchema.safeParse({ ...base, date_of_birth: "2024-02-29" }).success,
    ).toBe(true);
  });
});

describe("studentUpdateSchema", () => {
  const id = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

  it("accepts partial update (id only)", () => {
    expect(studentUpdateSchema.safeParse({ id }).success).toBe(true);
  });

  it("accepts full update", () => {
    expect(
      studentUpdateSchema.safeParse({ id, ...base, is_active: false }).success,
    ).toBe(true);
  });

  it("rejects invalid UUID for id", () => {
    expect(studentUpdateSchema.safeParse({ id: "bad" }).success).toBe(false);
  });
});

describe("national_id property", () => {
  it("non-empty alphanumeric ≤30 chars always passes", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9]{1,30}$/), (nid) => {
        return studentCreateSchema.safeParse({ ...base, national_id: nid }).success;
      }),
      { numRuns: 100 },
    );
  });
});
