"use server";

import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { withAuthenticatedUser } from "@/lib/auth/server-context";
import { COMMON_MESSAGES, ROLE_CREATION_MESSAGES } from "@/lib/localization/es-ec";
import type { AppRole } from "@/lib/auth/authorize";
import {
  assignBranchAdminSchema,
  assignBranchTeacherSchema,
  revokeBranchRoleSchema,
  revokeBranchTeacherSchema,
  revokeTeacherResultSchema,
  createBranchAdminSchema,
  createBranchTeacherSchema,
  listBranchTeacherOptionsSchema,
  type AssignBranchAdminInput,
  type AssignBranchTeacherInput,
  type RevokeBranchRoleInput,
  type RevokeBranchTeacherInput,
  type RevokeTeacherResult,
  type CreateBranchAdminInput,
  type CreateBranchTeacherInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StaffAssignment {
  user_id: string;
  role: AppRole;
  branch_id: string | null;
  assigned_at: string;
  display_name?: string;
}

export interface CreatedAccountCredentials {
  email: string;
  temporaryPassword: string;
}

export interface TeacherOption {
  id: string;
  name: string;
}

function generateTemporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

function isAuthorizationError(message: string): boolean {
  return message.includes("unauthorized") || message.includes("forbidden");
}

async function rollbackCreatedAccount(
  targetUserId: string,
  role: "admin" | "teacher",
  branchId: string,
  admin: ReturnType<typeof createAdminClient>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  try {
    await supabase.rpc("revoke_branch_role", {
      p_target: targetUserId,
      p_role: role,
      p_branch_id: branchId,
    });
  } catch {
    // Auth-user deletion below cascades profile rows and remains the final safeguard.
  }
  await admin.auth.admin.deleteUser(targetUserId).catch(() => undefined);
}

async function createCanonicalProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  profile: Pick<
    CreateBranchAdminInput,
    "first_name" | "surname" | "phone" | "date_of_birth"
  >
) {
  return admin.from("user_profiles").insert({
    user_id: userId,
    first_name: profile.first_name,
    surname: profile.surname,
    phone: profile.phone ?? null,
    date_of_birth: profile.date_of_birth,
  });
}

/** Assign an admin role to a target user on a branch. */
export async function assignBranchAdmin(
  input: AssignBranchAdminInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignBranchAdminSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_branch_admin", {
    p_target: parsed.data.targetUserId,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    return {
      success: false,
      error: isAuthorizationError(error.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }
  return { success: true, data: { id: data } };
}

/** Assign a teacher role to a target user on a branch. */
export async function assignBranchTeacher(
  input: AssignBranchTeacherInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignBranchTeacherSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_branch_teacher", {
    p_target: parsed.data.targetUserId,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    return {
      success: false,
      error: isAuthorizationError(error.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }
  return { success: true, data: { id: data } };
}

/** Revoke a branch-scoped role. Database authorization remains authoritative. */
export async function revokeBranchRole(
  input: RevokeBranchRoleInput
): Promise<ActionResult<{ revoked: boolean }>> {
  const parsed = revokeBranchRoleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_branch_role", {
    p_target: parsed.data.targetUserId,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    return {
      success: false,
      error: isAuthorizationError(error.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }
  return { success: true, data: { revoked: data } };
}

/**
 * Revoke a branch teacher with automatic reassignment to the configured default
 * teacher. Calls `revoke_teacher_with_reassignment` RPC which validates, checks
 * conflicts, closes/opens attribution periods, rewrites overrides, and soft-revokes
 * atomically. Does NOT alter legacy `revokeBranchRole` behavior.
 */
export async function revokeBranchTeacher(
  input: RevokeBranchTeacherInput
): Promise<ActionResult<RevokeTeacherResult>> {
  const parsed = revokeBranchTeacherSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_teacher_with_reassignment", {
    p_target_user_id: parsed.data.targetUserId,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    return {
      success: false,
      error: isAuthorizationError(error.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const result = revokeTeacherResultSchema.safeParse(data);
  if (!result.success) return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };

  return { success: true, data: result.data };
}

/** Owner creates an Auth account, canonical identity, and branch-admin role. */
export async function createBranchAdmin(
  input: CreateBranchAdminInput
): Promise<ActionResult<CreatedAccountCredentials>> {
  const parsed = createBranchAdminSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const identity = await getAuthenticatedContext();
  if (!identity.ok) return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  if (!identity.ctx.roles.includes("owner")) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });

  if (createError || !created.user) {
    return {
      success: false,
      error: createError?.message.includes("already been registered")
        ? ROLE_CREATION_MESSAGES.EMAIL_ALREADY_EXISTS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_branch_admin", {
    p_target: created.user.id,
    p_branch_id: parsed.data.branchId,
  });
  if (assignError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return {
      success: false,
      error: isAuthorizationError(assignError.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const { error: profileError } = await createCanonicalProfile(
    admin,
    created.user.id,
    parsed.data
  );
  if (profileError) {
    await rollbackCreatedAccount(
      created.user.id,
      "admin",
      parsed.data.branchId,
      admin,
      supabase
    );
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: { email: parsed.data.email, temporaryPassword } };
}

/**
 * Branch admin creates an Auth account, canonical identity, teacher role, and
 * branch roster record. Every failed post-creation write rolls the account back.
 */
export async function createBranchTeacher(
  input: CreateBranchTeacherInput
): Promise<ActionResult<CreatedAccountCredentials>> {
  const parsed = createBranchTeacherSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const identity = await getAuthenticatedContext();
  if (!identity.ok) return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  const isAdminOfBranch = identity.ctx.assignments.some(
    (assignment) =>
      assignment.role === "admin" && assignment.branchId === parsed.data.branchId
  );
  if (!isAdminOfBranch) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });

  if (createError || !created.user) {
    return {
      success: false,
      error: createError?.message.includes("already been registered")
        ? ROLE_CREATION_MESSAGES.EMAIL_ALREADY_EXISTS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_branch_teacher", {
    p_target: created.user.id,
    p_branch_id: parsed.data.branchId,
  });
  if (assignError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return {
      success: false,
      error: isAuthorizationError(assignError.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const { error: canonicalProfileError } = await createCanonicalProfile(
    admin,
    created.user.id,
    parsed.data
  );
  if (canonicalProfileError) {
    await rollbackCreatedAccount(
      created.user.id,
      "teacher",
      parsed.data.branchId,
      admin,
      supabase
    );
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: { email: parsed.data.email, temporaryPassword } };
}

/**
 * List staff assignments authorized by user_roles RLS, then resolve canonical
 * display names through the service client. Missing profiles remain unnamed.
 * Scoped to a specific branch when branchId is provided.
 */
export async function listBranchStaff(
  options?: { branchId?: string }
): Promise<ActionResult<StaffAssignment[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("user_roles")
    .select("user_id, role, branch_id, assigned_at")
    .is("revoked_at", null)
    .neq("role", "owner");

  if (options?.branchId) {
    query = query.eq("branch_id", options.branchId);
  }

  const { data, error } = await query.order("assigned_at", { ascending: false });

  if (error) {
    return {
      success: false,
      error: isAuthorizationError(error.message)
        ? COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS
        : COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  const assignments = (data ?? []) as Omit<StaffAssignment, "display_name">[];
  const userIds = [...new Set(assignments.map((assignment) => assignment.user_id))];
  if (userIds.length === 0) return { success: true, data: assignments };

  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = await admin
    .from("user_profiles")
    .select("user_id, first_name, surname")
    .in("user_id", userIds);
  if (profilesError) return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };

  const namesByUserId = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      `${profile.first_name} ${profile.surname}`,
    ])
  );
  return {
    success: true,
    data: assignments.map((assignment) => ({
      ...assignment,
      display_name: namesByUserId.get(assignment.user_id),
    })),
  };
}

/**
 * List branch-roster teachers that also have canonical identities. The roster
 * supplies membership; user_profiles supplies the only visible name.
 */
export async function listBranchTeacherOptions(
  input: unknown
): Promise<ActionResult<TeacherOption[]>> {
  const parsed = listBranchTeacherOptionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const identity = await getAuthenticatedContext();
  if (!identity.ok) return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  const isAdminOfBranch = identity.ctx.assignments.some(
    (assignment) =>
      assignment.role === "admin" && assignment.branchId === parsed.data.branchId
  );
  if (!isAdminOfBranch) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  // Query active teacher roles from user_roles (NOT teacher_profiles)
  const rosterResult = await withAuthenticatedUser(async (tx) => {
    return tx.user_roles.findMany({
      where: {
        role: "teacher",
        branch_id: parsed.data.branchId,
        revoked_at: null,
      },
      select: { user_id: true },
    });
  });
  if (!rosterResult.success) return rosterResult;
  if (rosterResult.data.length === 0) return { success: true, data: [] };

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("user_id, first_name, surname")
    .in(
      "user_id",
      rosterResult.data.map((r) => r.user_id)
    )
    .order("first_name", { ascending: true });
  if (error) return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };

  return {
    success: true,
    data: (profiles ?? []).map((profile) => ({
      id: profile.user_id,
      name: `${profile.first_name} ${profile.surname}`,
    })),
  };
}



/**
 * Enable self as teacher in own branch.
 * Restricted to admin-of-branch only. Uses the existing idempotent
 * assign_branch_teacher RPC with p_target = own userId.
 */
export async function enableSelfAsTeacher(
  input: { branchId: string }
): Promise<ActionResult<void>> {
  const identity = await getAuthenticatedContext();
  if (!identity.ok) {
    return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  }

  const isAdminOfBranch = identity.ctx.assignments.some(
    (a) => a.role === "admin" && a.branchId === input.branchId
  );
  if (!isAdminOfBranch) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_branch_teacher", {
    p_target: identity.ctx.userId,
    p_branch_id: input.branchId,
  });

  if (error) {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true };
}
