"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  BRANCH_STATUS,
  branchCreateSchema,
  branchIdSchema,
  branchListSchema,
  branchRecordSchema,
  branchUpdateSchema,
  type BranchCreateInput,
  type BranchUpdateInput,
  type EcuadorTimeZone,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const BRANCH_DEACTIVATION_ACTIVE_STUDENTS_ERROR =
  "Cannot deactivate a branch with active students";
const BRANCH_NOT_FOUND_ERROR = "Branch not found";
const BRANCH_REACTIVATION_NAME_CONFLICT_ERROR =
  "No se puede reactivar esta sucursal porque otra sucursal activa ya usa este nombre. Cambie el nombre de una de las sucursales primero.";

interface BranchDeactivationOutcome {
  id: string | null;
  error: string | null;
}

interface BranchReactivationOutcome {
  id: string | null;
  error: string | null;
}

/** Public branch type exposed by list/get actions. */
export interface BranchRecord {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  time_zone: EcuadorTimeZone;
  is_active: boolean;
}

/**
 * Create a new branch. Admin-only (RLS enforced).
 * Identity derived server-side — no client context accepted.
 */
export async function createBranch(
  input: BranchCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = branchCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.create({
        data: {
          name: parsed.data.name,
          address: parsed.data.address ?? null,
          phone: parsed.data.phone ?? null,
          time_zone: parsed.data.time_zone,
          is_active: parsed.data.is_active,
        },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("branches_name_uq")) {
      return { success: false, error: "A branch with this name already exists" };
    }
    return { success: false, error: "Operation failed" };
  }
}

/**
 * Update an existing branch. Admin-only (RLS enforced).
 * Identity derived server-side — no client context accepted.
 */
export async function updateBranch(
  input: BranchUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = branchUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...data } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.update({
        where: { id },
        data,
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("branches_name_uq")) {
      return { success: false, error: "A branch with this name already exists" };
    }
    return { success: false, error: "Operation failed" };
  }
}

/**
 * Soft-delete: deactivate a branch. Admin-only (RLS enforced).
 * Identity derived server-side — no client context accepted.
 */
export async function deactivateBranch(
  branchId: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = branchIdSchema.safeParse(branchId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const activeStudentCount = await tx.students.count({
        where: { branch_id: parsed.data, is_active: true },
      });

      if (activeStudentCount > 0) {
        return {
          id: null,
          error: BRANCH_DEACTIVATION_ACTIVE_STUDENTS_ERROR,
        } satisfies BranchDeactivationOutcome;
      }

      const branch = await tx.branches.update({
        where: { id: parsed.data },
        data: { is_active: false },
        select: { id: true },
      });

      return { id: branch.id, error: null } satisfies BranchDeactivationOutcome;
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? "Operation failed" };
    }

    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}

/**
 * Reactivate a branch. Admin-only (RLS enforced).
 * Identity derived server-side — no client context accepted.
 */
export async function reactivateBranch(
  branchId: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = branchIdSchema.safeParse(branchId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const branch = await tx.branches.findUnique({
        where: { id: parsed.data },
        select: { id: true, is_active: true },
      });

      if (branch === null) {
        return {
          id: null,
          error: BRANCH_NOT_FOUND_ERROR,
        } satisfies BranchReactivationOutcome;
      }

      if (branch.is_active) {
        return { id: branch.id, error: null } satisfies BranchReactivationOutcome;
      }

      try {
        const reactivatedBranch = await tx.branches.update({
          where: { id: branch.id },
          data: { is_active: true },
          select: { id: true },
        });

        return {
          id: reactivatedBranch.id,
          error: null,
        } satisfies BranchReactivationOutcome;
      } catch (error) {
        if (error instanceof Error && error.message.includes("branches_name_uq")) {
          return {
            id: null,
            error: BRANCH_REACTIVATION_NAME_CONFLICT_ERROR,
          } satisfies BranchReactivationOutcome;
        }

        throw error;
      }
    });

    if (!result.success) return result;
    if (result.data.id === null) {
      return { success: false, error: result.data.error ?? "Operation failed" };
    }

    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}

/**
 * List branches by lifecycle status. Any authenticated role can read.
 * Identity derived server-side — no client context accepted.
 */
export async function listBranches(
  input: unknown = {}
): Promise<ActionResult<BranchRecord[]>> {
  const parsed = branchListSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.findMany({
        where: {
          is_active: parsed.data.status === BRANCH_STATUS.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          time_zone: true,
          is_active: true,
        },
        orderBy: { name: "asc" },
      });
    });

    if (!result.success) return result;

    const records = branchRecordSchema.array().safeParse(result.data);
    if (!records.success) {
      return { success: false, error: "Operation failed" };
    }

    return { success: true, data: records.data };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}

export interface ActiveBranchCount {
  count: number;
}

export async function getActiveBranchCount(): Promise<
  ActionResult<ActiveBranchCount>
> {
  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.count({ where: { is_active: true } });
    });

    if (!result.success) return result;

    return { success: true, data: { count: result.data } };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}

/**
 * Get a single branch by ID. Any authenticated role can read.
 * Identity derived server-side — no client context accepted.
 */
export async function getBranch(
  branchId: string
): Promise<ActionResult<BranchRecord | null>> {
  const parsed = branchIdSchema.safeParse(branchId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.findUnique({
        where: { id: parsed.data },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          time_zone: true,
          is_active: true,
        },
      });
    });

    if (!result.success) return result;

    const record = branchRecordSchema.nullable().safeParse(result.data);
    if (!record.success) {
      return { success: false, error: "Operation failed" };
    }

    return { success: true, data: record.data };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}
