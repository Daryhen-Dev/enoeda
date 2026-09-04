import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isStudentInvitationState,
  type StudentEnrollmentInvitation,
} from "@/lib/domain/student-enrollment/types";

export const STUDENT_IDENTITY_REASONS = {
  NO_STUDENT: "no_student",
  UNAUTHENTICATED: "unauthenticated",
} as const;

export type StudentIdentityReason =
  (typeof STUDENT_IDENTITY_REASONS)[keyof typeof STUDENT_IDENTITY_REASONS];

export interface StudentIdentity {
  authUserId: string;
  dateOfBirth: string;
  email: string;
  firstName: string;
  id: string;
  isActive: boolean;
  nationalId: string;
  phone: string | null;
  surname: string;
}

export type StudentIdentityResult =
  | { ok: true; student: StudentIdentity }
  | { ok: false; reason: StudentIdentityReason };

export const STUDENT_ENROLLMENT_CONTEXT_KINDS = {
  INVALID: "invalid",
  INVITATION: "invitation",
  STUDENT: "student",
  UNAUTHENTICATED: "unauthenticated",
} as const;

export type StudentEnrollmentContextKind =
  (typeof STUDENT_ENROLLMENT_CONTEXT_KINDS)[keyof typeof STUDENT_ENROLLMENT_CONTEXT_KINDS];

export type StudentEnrollmentContextResult =
  | { kind: typeof STUDENT_ENROLLMENT_CONTEXT_KINDS.STUDENT; student: StudentIdentity }
  | {
      kind: typeof STUDENT_ENROLLMENT_CONTEXT_KINDS.INVITATION;
      invitation: StudentEnrollmentInvitation;
    }
  | { kind: typeof STUDENT_ENROLLMENT_CONTEXT_KINDS.UNAUTHENTICATED }
  | { kind: typeof STUDENT_ENROLLMENT_CONTEXT_KINDS.INVALID };

interface AuthenticatedUser {
  id: string;
}

function toStudentIdentity(student: {
  auth_user_id: string | null;
  date_of_birth: string;
  email: string;
  first_name: string;
  id: string;
  is_active: boolean;
  national_id: string;
  phone: string | null;
  surname: string;
}): StudentIdentity | null {
  if (student.auth_user_id === null) {
    return null;
  }

  return {
    authUserId: student.auth_user_id,
    dateOfBirth: student.date_of_birth,
    email: student.email,
    firstName: student.first_name,
    id: student.id,
    isActive: student.is_active,
    nationalId: student.national_id,
    phone: student.phone,
    surname: student.surname,
  };
}

async function resolveLinkedStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: AuthenticatedUser
): Promise<StudentIdentity | null> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, auth_user_id, first_name, surname, national_id, email, phone, date_of_birth, is_active"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  return toStudentIdentity(data);
}

export async function getStudentIdentity(): Promise<StudentIdentityResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || user === null) {
    return { ok: false, reason: STUDENT_IDENTITY_REASONS.UNAUTHENTICATED };
  }

  const student = await resolveLinkedStudent(supabase, user);
  if (student === null) {
    return { ok: false, reason: STUDENT_IDENTITY_REASONS.NO_STUDENT };
  }

  return { ok: true, student };
}

export async function getStudentEnrollmentContext(): Promise<StudentEnrollmentContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || user === null) {
    return { kind: STUDENT_ENROLLMENT_CONTEXT_KINDS.UNAUTHENTICATED };
  }

  const student = await resolveLinkedStudent(supabase, user);
  if (student !== null) {
    return { kind: STUDENT_ENROLLMENT_CONTEXT_KINDS.STUDENT, student };
  }

  const { data, error } = await supabase.rpc("get_my_student_enrollment_state");
  const invitation = data?.[0];
  if (
    error ||
    invitation === undefined ||
    !isStudentInvitationState(invitation.state)
  ) {
    return { kind: STUDENT_ENROLLMENT_CONTEXT_KINDS.INVALID };
  }

  return {
    kind: STUDENT_ENROLLMENT_CONTEXT_KINDS.INVITATION,
    invitation: {
      email: invitation.email,
      passwordConfigured: invitation.password_set_at !== null,
      state: invitation.state,
    },
  };
}
