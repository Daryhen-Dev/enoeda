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
  INVALID_EMAIL: "El correo electrónico no es válido.",
  FIRST_NAME_REQUIRED: "El nombre es obligatorio.",
  FIRST_NAME_MAX_LENGTH: "El nombre debe tener como máximo 100 caracteres.",
  SURNAME_REQUIRED: "El apellido es obligatorio.",
  SURNAME_MAX_LENGTH: "El apellido debe tener como máximo 100 caracteres.",
  PHONE_MAX_LENGTH: "El teléfono debe tener como máximo 30 caracteres.",
  DATE_OF_BIRTH_FORMAT: "La fecha de nacimiento debe tener el formato YYYY-MM-DD.",
  INVALID_DATE_OF_BIRTH: "La fecha de nacimiento no es una fecha válida.",
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

// --- Account creation schemas (owner-only, admin-of-branch-only) ---

const PROFILE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) {
    return false;
  }
  return day <= new Date(year, month, 0).getDate();
}

const accountProfileSchema = z.object({
  first_name: z
    .string()
    .min(1, { error: ROLE_MESSAGES.FIRST_NAME_REQUIRED })
    .max(100, { error: ROLE_MESSAGES.FIRST_NAME_MAX_LENGTH }),
  surname: z
    .string()
    .min(1, { error: ROLE_MESSAGES.SURNAME_REQUIRED })
    .max(100, { error: ROLE_MESSAGES.SURNAME_MAX_LENGTH }),
  phone: z
    .string()
    .max(30, { error: ROLE_MESSAGES.PHONE_MAX_LENGTH })
    .optional(),
  date_of_birth: z
    .string()
    .regex(PROFILE_DATE_PATTERN, { error: ROLE_MESSAGES.DATE_OF_BIRTH_FORMAT })
    .refine(isValidCalendarDate, {
      error: ROLE_MESSAGES.INVALID_DATE_OF_BIRTH,
    }),
});

/** Owner creates a new Auth account, canonical profile, and branch admin role. */
export const createBranchAdminSchema = z
  .object({
    email: z.email({ error: ROLE_MESSAGES.INVALID_EMAIL }),
    branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
  })
  .extend(accountProfileSchema.shape);

/**
 * Branch admin creates a new Auth account and assigns it as teacher in
 * their own branch, together with canonical identity and roster data.
 */
export const createBranchTeacherSchema = z
  .object({
    email: z.email({ error: ROLE_MESSAGES.INVALID_EMAIL }),
    branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
  })
  .extend(accountProfileSchema.shape);

/** List teacher accounts for a branch (for teacher-picker UI). */
export const listBranchTeacherOptionsSchema = z.object({
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
});

export type CreateBranchAdminInput = z.infer<typeof createBranchAdminSchema>;
export type CreateBranchTeacherInput = z.infer<typeof createBranchTeacherSchema>;
export type ListBranchTeacherOptionsInput = z.infer<typeof listBranchTeacherOptionsSchema>;

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

// --- Set branch default teacher ---

/** Input for configuring the branch default teacher. */
export const setBranchDefaultTeacherSchema = z.object({
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
  teacherId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
});

export type SetBranchDefaultTeacherInput = z.infer<typeof setBranchDefaultTeacherSchema>;

// --- Revoke teacher with reassignment ---

/** Input for revoking a branch teacher with default-teacher reassignment. */
export const revokeBranchTeacherSchema = z.object({
  targetUserId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_TARGET_USER_ID }),
  branchId: z.string().uuid({ message: ROLE_MESSAGES.INVALID_BRANCH_ID }),
});

export type RevokeBranchTeacherInput = z.infer<typeof revokeBranchTeacherSchema>;

/** Conflict detail returned when revocation is blocked by scheduling overlap. */
const revokeConflictSchema = z.object({
  classId: z.string(),
  dayOfWeek: z.number(),
  startTime: z.string(),
});

/** Successful revocation result from the RPC. */
const revokedResultSchema = z.object({
  status: z.literal("revoked"),
  reassignedClassCount: z.number(),
  cutoff: z.string(),
});

/** Blocked revocation result from the RPC. */
const blockedResultSchema = z.object({
  status: z.literal("blocked"),
  reason: z.enum(["no_default_teacher", "revoked_is_default", "conflict"]),
  conflicts: z.array(revokeConflictSchema).optional(),
});

/** Union result from `revoke_teacher_with_reassignment` RPC. */
export const revokeTeacherResultSchema = z.union([revokedResultSchema, blockedResultSchema]);

export type RevokeTeacherResult = z.infer<typeof revokeTeacherResultSchema>;
