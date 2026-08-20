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
  email: "example@student.test",
  date_of_birth: "2000-01-01",
} as const;

describe("studentCreateSchema", () => {
  it("accepts valid input and defaults is_active and phone", () => {
    const r = studentCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.is_active).toBe(true);
      expect(r.data.phone).toBeNull();
    }
  });

  it("accepts and normalizes an optional phone", () => {
    const r = studentCreateSchema.safeParse({ ...base, phone: "contact-value" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("contact-value");
  });

  it("accepts a phone with exactly 30 characters", () => {
    expect(studentCreateSchema.safeParse({ ...base, phone: "p".repeat(30) }).success).toBe(true);
  });

  it("rejects a phone with more than 30 characters", () => {
    expect(studentCreateSchema.safeParse({ ...base, phone: "p".repeat(31) }).success).toBe(false);
  });

  it("normalizes an empty phone to null", () => {
    const r = studentCreateSchema.safeParse({ ...base, phone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeNull();
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

  it("accepts partial update with one editable field", () => {
    expect(
      studentUpdateSchema.safeParse({ id, first_name: "Ana" }).success
    ).toBe(true);
  });

  it("accepts full update", () => {
    expect(
      studentUpdateSchema.safeParse({ id, ...base, is_active: false }).success,
    ).toBe(true);
  });

  it("normalizes an empty phone to null and preserves absent phone", () => {
    const emptyPhone = studentUpdateSchema.safeParse({ id, phone: "" });
    expect(emptyPhone.success).toBe(true);
    if (emptyPhone.success) expect(emptyPhone.data.phone).toBeNull();

    const absentPhone = studentUpdateSchema.safeParse({ id, first_name: "Example" });
    expect(absentPhone.success).toBe(true);
    if (absentPhone.success) expect(absentPhone.data.phone).toBeUndefined();
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
