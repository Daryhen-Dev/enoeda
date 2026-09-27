import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PublicStudentRegistrationInput,
} from "./schema";
import type {
  PublicBranchOption,
  PublicStudentRegistrationResult,
} from "./types";

export async function listPublicActiveBranches(): Promise<PublicBranchOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || data === null) {
    return [];
  }

  return data.map((branch) => ({ id: branch.id, name: branch.name }));
}

export async function registerPublicStudent(
  input: PublicStudentRegistrationInput
): Promise<PublicStudentRegistrationResult> {
  const admin = createAdminClient();
  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id")
    .eq("id", input.branch_id)
    .eq("is_active", true)
    .maybeSingle();

  if (branchError || branch === null) {
    return { success: false };
  }

  const { data: createdAuth, error: authError } =
    await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      password: input.password,
    });
  const authUser = createdAuth.user;

  if (authError || authUser === null) {
    return { success: false };
  }

  const { data: student, error: studentError } = await admin
    .from("students")
    .insert({
      activation_status: "pending",
      auth_user_id: authUser.id,
      branch_id: input.branch_id,
      date_of_birth: input.date_of_birth,
      email: input.email,
      first_name: input.first_name,
      is_active: true,
      national_id: input.national_id,
      phone: input.phone,
      surname: input.surname,
    })
    .select("id")
    .maybeSingle();

  if (studentError || student === null) {
    await admin.auth.admin.deleteUser(authUser.id);
    return { success: false };
  }

  return { success: true, studentId: student.id };
}
