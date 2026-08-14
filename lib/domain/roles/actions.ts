"use server";

import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { COMMON_MESSAGES, ROLE_CREATION_MESSAGES } from "@/lib/localization/es-ec";
import type { AppRole } from "@/lib/auth/authorize";
import {
  assignBranchAdminSchema,
  assignBranchTeacherSchema,
  revokeBranchRoleSchema,
  createBranchAdminSchema,
  createBranchTeacherSchema,
  type AssignBranchAdminInput,
  type AssignBranchTeacherInput,
  type RevokeBranchRoleInput,
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
}

/**
 * Assign admin role to a target user on a specific branch.
 * Owner-only — authorization enforced by the database RPC.
 */
export async function assignBranchAdmin(
  input: AssignBranchAdminInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignBranchAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_branch_admin", {
    p_target: parsed.data.targetUserId,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: { id: data } };
}

/**
 * Assign teacher role to a target user on a specific branch.
 * Admin-of-branch only — authorization enforced by the database RPC.
 */
export async function assignBranchTeacher(
  input: AssignBranchTeacherInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignBranchTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_branch_teacher", {
    p_target: parsed.data.targetUserId,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: { id: data } };
}

/**
 * Revoke a branch-scoped role (admin or teacher) from a target user.
 * Owner can revoke any; admin can revoke teacher in own branch.
 * Authorization enforced by the database RPC.
 */
export async function revokeBranchRole(
  input: RevokeBranchRoleInput
): Promise<ActionResult<{ revoked: boolean }>> {
  const parsed = revokeBranchRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_branch_role", {
    p_target: parsed.data.targetUserId,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId,
  });

  if (error) {
    if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: { revoked: data } };
}

export interface CreatedAccountCredentials {
  email: string;
  temporaryPassword: string;
}

/** Generates a random URL-safe temporary password (24 chars, base64url). */
function generateTemporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Owner creates a brand-new Auth account (never self-registered) and
 * assigns it as branch admin in one step. Uses the service_role admin
 * client to create the user with a temporary password and
 * `must_change_password: true` in app_metadata; the user must change
 * this password on first login before reaching /dashboard.
 *
 * Authorization is checked explicitly here (owner-only) BEFORE any
 * admin-client call — the admin client itself performs no authorization.
 */
export async function createBranchAdmin(
  input: CreateBranchAdminInput
): Promise<ActionResult<CreatedAccountCredentials>> {
  const parsed = createBranchAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const identity = await getAuthenticatedContext();
  if (!identity.ok) {
    return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  }
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
    if (createError?.message.includes("already been registered")) {
      return { success: false, error: ROLE_CREATION_MESSAGES.EMAIL_ALREADY_EXISTS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_branch_admin", {
    p_target: created.user.id,
    p_branch_id: parsed.data.branchId,
  });

  if (assignError) {
    // Roll back the created Auth account so no orphaned user remains.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    if (
      assignError.message.includes("unauthorized") ||
      assignError.message.includes("forbidden")
    ) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return {
    success: true,
    data: { email: parsed.data.email, temporaryPassword },
  };
}

/**
 * Branch admin creates a brand-new Auth account (never self-registered)
 * and assigns it as teacher within the admin's own branch. Authorization
 * (admin-of-this-branch) is enforced twice: once here before account
 * creation, and again by the `assign_branch_teacher` RPC guard.
 */
export async function createBranchTeacher(
  input: CreateBranchTeacherInput
): Promise<ActionResult<CreatedAccountCredentials>> {
  const parsed = createBranchTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const identity = await getAuthenticatedContext();
  if (!identity.ok) {
    return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  }
  const isAdminOfBranch = identity.ctx.assignments.some(
    (a) => a.role === "admin" && a.branchId === parsed.data.branchId
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
    if (createError?.message.includes("already been registered")) {
      return { success: false, error: ROLE_CREATION_MESSAGES.EMAIL_ALREADY_EXISTS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_branch_teacher", {
    p_target: created.user.id,
    p_branch_id: parsed.data.branchId,
  });

  if (assignError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    if (
      assignError.message.includes("unauthorized") ||
      assignError.message.includes("forbidden")
    ) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return {
    success: true,
    data: { email: parsed.data.email, temporaryPassword },
  };
}

/**
 * List all active staff assignments (non-revoked roles) with branch context.
 * Uses current_roles()-style composite result from a custom query.
 * Owner sees all; admin sees own-branch; enforced by RLS on user_roles.
 */
export async function listBranchStaff(): Promise<ActionResult<StaffAssignment[]>> {
  const supabase = await createClient();

  // Query user_roles directly — RLS policies enforce visibility
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role, branch_id, assigned_at")
    .is("revoked_at", null)
    .neq("role", "owner")
    .order("assigned_at", { ascending: false });

  if (error) {
    if (error.message.includes("unauthorized")) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: (data ?? []) as StaffAssignment[] };
}


