"use server";

import {
  STUDENT_IDENTITY_REASONS,
  getStudentIdentity,
} from "@/lib/auth/student-identity-resolver";
import { COMMON_MESSAGES, STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";
import { createClient } from "@/lib/supabase/server";
import { updateOwnStudentPhoneSchema } from "./schema";
import type { StudentEnrollmentActionResult } from "./types";

function actionError<T>(error: string): StudentEnrollmentActionResult<T> {
  return { success: false, error };
}

export async function updateOwnStudentPhone(
  input: unknown
): Promise<StudentEnrollmentActionResult<{ id: string }>> {
  const parsed = updateOwnStudentPhoneSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const identity = await getStudentIdentity();
  if (!identity.ok) {
    return identity.reason === STUDENT_IDENTITY_REASONS.UNAUTHENTICATED
      ? actionError(COMMON_MESSAGES.AUTHENTICATION_REQUIRED)
      : actionError(STUDENT_ENROLLMENT_MESSAGES.PROFILE_UNAVAILABLE);
  }
  if (!identity.student.isActive) {
    return actionError(STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_own_student_phone", {
    p_phone: parsed.data.phone ?? null,
  });

  if (error || data === null) {
    return actionError(
      error?.message.includes("inactive")
        ? STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY
        : STUDENT_ENROLLMENT_MESSAGES.PHONE_SAVE_FAILURE
    );
  }

  return { success: true, data: { id: data } };
}
