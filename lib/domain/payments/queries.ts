import type { TransactionClient } from "@/lib/prisma/client";

export interface OverdueStudentRow {
  student_id: string;
  student_name: string;
  discipline_name: string;
  next_due_date: Date;
}

/**
 * Count distinct students who are overdue (next_due_date < today).
 * Pure tx-scoped query — reusable from dashboard and payments actions.
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function countOverdueStudents(
  tx: TransactionClient,
  branchId: string
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await tx.student_disciplines.findMany({
    where: {
      is_active: true,
      next_due_date: { lt: today },
      students: { branch_id: branchId },
    },
    select: { student_id: true },
    distinct: ["student_id"],
  });

  return result.length;
}

/**
 * List students who are overdue with discipline and date details.
 * Branch scoping is enforced both by RLS and the explicit branchId filter.
 */
export async function listOverdueStudents(
  tx: TransactionClient,
  branchId: string
): Promise<OverdueStudentRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await tx.student_disciplines.findMany({
    where: {
      is_active: true,
      next_due_date: { lt: today },
      students: { branch_id: branchId },
    },
    select: {
      students: { select: { id: true, first_name: true, surname: true } },
      disciplines: { select: { name: true } },
      next_due_date: true,
    },
    orderBy: { next_due_date: "asc" },
  });

  return rows.map((row) => ({
    student_id: row.students.id,
    student_name: `${row.students.first_name} ${row.students.surname}`,
    discipline_name: row.disciplines.name,
    next_due_date: row.next_due_date!,
  }));
}
