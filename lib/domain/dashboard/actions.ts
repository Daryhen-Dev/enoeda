"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";

interface ActionSuccess<T> {
  success: true;
  data: T;
}

interface ActionFailure {
  success: false;
  error: string;
}

type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export interface ActiveStudentsByBranch {
  branch_id: string;
  branch_name: string;
  active_student_count: number;
}

export interface DashboardKpis {
  active_branch_count: number;
  active_student_count: number;
  inactive_student_count: number;
  active_students_by_branch: ActiveStudentsByBranch[];
}

export async function getDashboardKpis(): Promise<ActionResult<DashboardKpis>> {
  try {
    const result = await withAuthenticatedUser(async (tx) => {
      const [branches, activeStudentCount, inactiveStudentCount, activeStudentsByBranch] =
        await Promise.all([
          tx.branches.findMany({
            where: { is_active: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          tx.students.count({ where: { is_active: true } }),
          tx.students.count({ where: { is_active: false } }),
          tx.students.groupBy({
            by: ["branch_id"],
            where: { is_active: true },
            _count: { _all: true },
          }),
        ]);
      const activeCountByBranch = new Map(
        activeStudentsByBranch.map((branch) => [
          branch.branch_id,
          branch._count._all,
        ])
      );

      return {
        active_branch_count: branches.length,
        active_student_count: activeStudentCount,
        inactive_student_count: inactiveStudentCount,
        active_students_by_branch: branches.map((branch) => ({
          branch_id: branch.id,
          branch_name: branch.name,
          active_student_count: activeCountByBranch.get(branch.id) ?? 0,
        })),
      };
    });

    if (!result.success) {
      return { success: false, error: "Dashboard data is unavailable" };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Dashboard data is unavailable" };
  }
}
