"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import { assertCallerBranchContext } from "@/lib/auth/branch-assertion";
import { countOverdueStudents } from "@/lib/domain/payments/queries";

interface ActionSuccess<T> {
  success: true;
  data: T;
}

interface ActionFailure {
  success: false;
  error: string;
}

type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export interface DashboardKpis {
  branch_name: string;
  active_student_count: number;
  inactive_student_count: number;
  overdue_student_count: number;
}

/**
 * Get dashboard KPIs scoped to a single validated branch.
 * Requires branchId — callers must resolve context at page level.
 * Validates caller has active branch assignment internally (fail-closed).
 */
export async function getDashboardKpis(
  branchId?: string
): Promise<ActionResult<DashboardKpis>> {
  if (!branchId) {
    return { success: false, error: "Dashboard data is unavailable" };
  }

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      // Validate caller has active assignment for this branch
      const branchError = assertCallerBranchContext(ctx, branchId);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      const [branch, activeStudentCount, inactiveStudentCount, overdueCount] =
        await Promise.all([
          tx.branches.findUnique({
            where: { id: branchId },
            select: { id: true, name: true },
          }),
          tx.students.count({ where: { is_active: true, branch_id: branchId } }),
          tx.students.count({ where: { is_active: false, branch_id: branchId } }),
          countOverdueStudents(tx, branchId),
        ]);

      if (!branch) {
        return null;
      }

      return {
        branch_name: branch.name,
        active_student_count: activeStudentCount,
        inactive_student_count: inactiveStudentCount,
        overdue_student_count: overdueCount,
      };
    });

    if (!result.success) {
      return { success: false, error: "Dashboard data is unavailable" };
    }

    if (result.data === null) {
      return { success: false, error: "Dashboard data is unavailable" };
    }

    if ("__branchError" in result.data) {
      return { success: false, error: (result.data as { __branchError: string }).__branchError };
    }

    return { success: true, data: result.data as DashboardKpis };
  } catch {
    return { success: false, error: "Dashboard data is unavailable" };
  }
}
