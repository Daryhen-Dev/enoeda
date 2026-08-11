"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  studentCreateSchema,
  studentIdSchema,
  type StudentCreateInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StudentProfile {
  id: string;
  branch_id: string;
  first_name: string;
  surname: string;
  national_id: string;
  email: string;
  date_of_birth: Date;
  is_active: boolean;
}

export async function getStudentById(
  id: string
): Promise<ActionResult<StudentProfile>> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx) => {
    return tx.students.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        branch_id: true,
        first_name: true,
        surname: true,
        national_id: true,
        email: true,
        date_of_birth: true,
        is_active: true,
      },
    });
  });

  if (!result.success) return result;
  if (result.data === null) {
    return { success: false, error: "Student not found" };
  }

  return {
    success: true,
    data: {
      id: result.data.id,
      branch_id: result.data.branch_id,
      first_name: result.data.first_name,
      surname: result.data.surname,
      national_id: result.data.national_id,
      email: result.data.email,
      date_of_birth: result.data.date_of_birth,
      is_active: result.data.is_active,
    },
  };
}

/**
 * Create a new student. Admin-only (RLS enforced).
 * Identity derived server-side via withAuthenticatedUser.
 * Transaction failures are intentionally redacted by the executor.
 */
export async function createStudent(
  input: StudentCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx) => {
    return tx.students.create({
      data: {
        branch_id: parsed.data.branch_id,
        first_name: parsed.data.first_name,
        surname: parsed.data.surname,
        national_id: parsed.data.national_id,
        email: parsed.data.email,
        date_of_birth: new Date(parsed.data.date_of_birth),
        is_active: parsed.data.is_active,
      },
      select: { id: true },
    });
  });

  if (!result.success) return result;
  return { success: true, data: { id: result.data.id } };
}
