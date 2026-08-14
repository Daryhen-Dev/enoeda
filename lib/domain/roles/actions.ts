"use server";

import { createClient } from "@/lib/supabase/server";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import type { AppRole } from "@/lib/auth/authorize";
import {
  assignBranchAdminSchema,
  assignBranchTeacherSchema,
  revokeBranchRoleSchema,
  type AssignBranchAdminInput,
  type AssignBranchTeacherInput,
  type RevokeBranchRoleInput,
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


