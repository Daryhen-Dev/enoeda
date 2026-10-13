/**
 * "Datos incompletos" completeness helper for students.
 *
 * A student is incomplete when any of the optional identity fields
 * (national id, email, date of birth) is still NULL. Names and phone are
 * never part of completeness: names are always required and phone stays
 * out of the badge by decision.
 */

export const STUDENT_MISSING_DATA_FIELDS = {
  NATIONAL_ID: "national_id",
  EMAIL: "email",
  DATE_OF_BIRTH: "date_of_birth",
} as const;

export type StudentMissingDataField =
  (typeof STUDENT_MISSING_DATA_FIELDS)[keyof typeof STUDENT_MISSING_DATA_FIELDS];

/** Minimal shape both the list item and the detail profile satisfy. */
export interface StudentDataCompleteness {
  national_id: string | null;
  email: string | null;
  /** Birth date as stored (Date) or already serialized (YYYY-MM-DD string). */
  date_of_birth: Date | string | null;
}

/**
 * Returns the optional identity fields the student is still missing,
 * in a stable order: national id, email, date of birth.
 */
export function getMissingStudentData(
  student: StudentDataCompleteness
): StudentMissingDataField[] {
  const missing: StudentMissingDataField[] = [];

  if (student.national_id === null) {
    missing.push(STUDENT_MISSING_DATA_FIELDS.NATIONAL_ID);
  }
  if (student.email === null) {
    missing.push(STUDENT_MISSING_DATA_FIELDS.EMAIL);
  }
  if (student.date_of_birth === null) {
    missing.push(STUDENT_MISSING_DATA_FIELDS.DATE_OF_BIRTH);
  }

  return missing;
}

/** True when any optional identity field is missing ("Datos incompletos"). */
export function hasIncompleteStudentData(
  student: StudentDataCompleteness
): boolean {
  return getMissingStudentData(student).length > 0;
}
