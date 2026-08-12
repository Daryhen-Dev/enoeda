"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  branchCreateSchema,
  branchIdSchema,
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
      return tx.branches.update({
        where: { id: parsed.data },
        data: { is_active: false },
        select: { id: true },
      });
    });

    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: "Operation failed" };
  }
}

/**
 * List all active branches. Any authenticated role can read.
 * Identity derived server-side — no client context accepted.
 */
export async function listBranches(): Promise<ActionResult<BranchRecord[]>> {
  try {
    const result = await withAuthenticatedUser(async (tx) => {
      return tx.branches.findMany({
        where: { is_active: true },
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
