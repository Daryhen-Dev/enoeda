import "server-only";

import { createClient } from "@/lib/supabase/server";

export const STUDENT_IDENTITY_REASONS = {
  NO_STUDENT: "no_student",
  UNAUTHENTICATED: "unauthenticated",
} as const;

export type StudentIdentityReason =
  (typeof STUDENT_IDENTITY_REASONS)[keyof typeof STUDENT_IDENTITY_REASONS];

export const STUDENT_ACTIVATION_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
} as const;

export type StudentActivationStatus =
  (typeof STUDENT_ACTIVATION_STATUS)[keyof typeof STUDENT_ACTIVATION_STATUS];

export interface StudentIdentity {
  activationStatus: StudentActivationStatus;
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

interface AuthenticatedUser {
  id: string;
}

interface StudentIdentityRow {
  activation_status: string;
  auth_user_id: string | null;
  date_of_birth: string;
  email: string;
  first_name: string;
  id: string;
  is_active: boolean;
  national_id: string;
  phone: string | null;
  surname: string;
}

function isStudentActivationStatus(value: string): value is StudentActivationStatus {
  return Object.values(STUDENT_ACTIVATION_STATUS).some(
    (status) => status === value
  );
}

function toStudentIdentity(student: StudentIdentityRow): StudentIdentity | null {
  if (
    student.auth_user_id === null ||
    !isStudentActivationStatus(student.activation_status)
  ) {
    return null;
  }

  return {
    activationStatus: student.activation_status,
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
      "id, auth_user_id, first_name, surname, national_id, email, phone, date_of_birth, is_active, activation_status"
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
