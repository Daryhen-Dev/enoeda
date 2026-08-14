import { z } from "zod";

/**
 * Grantable roles — 'owner' excluded by design.
 * The owner role is non-assignable and non-revocable via application.
 */
export const GRANTABLE_ROLES = ["admin", "teacher"] as const;

export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const ROLE_MESSAGES = {
  INVALID_TARGET_USER_ID: "El identificador del usuario destino no es válido.",
  INVALID_BRANCH_ID: "El identificador de la sucursal no es válido.",
  INVALID_ROLE: "El rol debe ser admin o teacher.",
} as const;

// --- Branch-scoped schemas ---

/** Assign an admin to a specific branch (owner-only). */
export const assignBranchAdminSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
});

/** Assign a teacher to a specific branch (admin-of-branch only). */
export const assignBranchTeacherSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
});

/** Revoke a branch-scoped role (owner any; admin teacher-in-own-branch). */
export const revokeBranchRoleSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
  role: z.enum(GRANTABLE_ROLES, { error: ROLE_MESSAGES.INVALID_ROLE }),
});

export type AssignBranchAdminInput = z.infer<typeof assignBranchAdminSchema>;
export type AssignBranchTeacherInput = z.infer<typeof assignBranchTeacherSchema>;
export type RevokeBranchRoleInput = z.infer<typeof revokeBranchRoleSchema>;

// --- Legacy flat schemas (kept for reference; RPCs dropped in migration) ---

export const grantRoleSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  role: z.enum(GRANTABLE_ROLES, { error: ROLE_MESSAGES.INVALID_ROLE }),
});

export const revokeRoleSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  role: z.enum(GRANTABLE_ROLES, { error: ROLE_MESSAGES.INVALID_ROLE }),
});

export type GrantRoleInput = z.infer<typeof grantRoleSchema>;
export type RevokeRoleInput = z.infer<typeof revokeRoleSchema>;

/** Type guard: checks if a value is a grantable role. */
export function isGrantableRole(value: unknown): value is GrantableRole {
  return (
    typeof value === "string" &&
    GRANTABLE_ROLES.some((role) => role === value)
  );
}
