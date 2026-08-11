"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  studentCreateSchema,
  type StudentCreateInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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
