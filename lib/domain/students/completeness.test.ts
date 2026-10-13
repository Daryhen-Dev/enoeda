/**
 * Unit tests for the "Datos incompletos" completeness helper.
 * Pure functions — no DB, no components.
 */
import { describe, it, expect } from "vitest";

import {
  getMissingStudentData,
  hasIncompleteStudentData,
  STUDENT_MISSING_DATA_FIELDS,
} from "./completeness";

const BIRTH_DATE = new Date("2000-01-01T00:00:00.000Z");

describe("getMissingStudentData", () => {
  it("returns no missing fields for a complete student", () => {
    expect(
      getMissingStudentData({
        national_id: "12345678",
        email: "juan@example.com",
        date_of_birth: BIRTH_DATE,
      })
    ).toEqual([]);
  });

  it("returns no missing fields for a complete student with string birth date", () => {
    expect(
      getMissingStudentData({
        national_id: "12345678",
        email: "juan@example.com",
        date_of_birth: "2000-01-01",
      })
    ).toEqual([]);
  });

  it("reports each missing field in stable order", () => {
    expect(
      getMissingStudentData({
        national_id: null,
        email: null,
        date_of_birth: null,
      })
    ).toEqual([
      STUDENT_MISSING_DATA_FIELDS.NATIONAL_ID,
      STUDENT_MISSING_DATA_FIELDS.EMAIL,
      STUDENT_MISSING_DATA_FIELDS.DATE_OF_BIRTH,
    ]);
  });

  it("reports only the fields that are missing", () => {
    expect(
      getMissingStudentData({
        national_id: "12345678",
        email: null,
        date_of_birth: null,
      })
    ).toEqual([
      STUDENT_MISSING_DATA_FIELDS.EMAIL,
      STUDENT_MISSING_DATA_FIELDS.DATE_OF_BIRTH,
    ]);
  });
});

describe("hasIncompleteStudentData", () => {
  it("is false when every optional field is present", () => {
    expect(
      hasIncompleteStudentData({
        national_id: "12345678",
        email: "juan@example.com",
        date_of_birth: BIRTH_DATE,
      })
    ).toBe(false);
  });

  it("is true when any optional field is null", () => {
    expect(
      hasIncompleteStudentData({
        national_id: null,
        email: "juan@example.com",
        date_of_birth: BIRTH_DATE,
      })
    ).toBe(true);
  });
});
