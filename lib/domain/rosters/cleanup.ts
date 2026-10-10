/**
 * Application-level roster cleanup (T8): roster eligibility is only checked
 * by the DB trigger on INSERT, so stale rows must be removed when a student
 * loses eligibility — enrollment suspension or a switch to per_class
 * billing. Past months and past one-time classes are never touched so
 * historical attendance stays intact.
 *
 * "Current/future" follows the branch-local calendar date (payments
 * convention): monthly groups whose period_month is the first day of the
 * current month or later, and one-time classes dated today or later.
 */
import { dateOnlyToUtcDate } from "@/lib/date";
import { getBranchLocalToday } from "@/lib/domain/payments/queries";
import type { TransactionClient } from "@/lib/prisma/client";

export interface RemoveStudentFromFutureRostersInput {
  branchId: string;
  studentId: string;
  disciplineId: string;
}

/**
 * Removes the student from every roster of the discipline that is still
 * current or upcoming (monthly groups of the current month onward, and
 * upcoming one-time classes). Returns the number of removed roster rows.
 */
export async function removeStudentFromCurrentAndFutureRosters(
  tx: TransactionClient,
  input: RemoveStudentFromFutureRostersInput
): Promise<number> {
  const { branchId, studentId, disciplineId } = input;

  const today = await getBranchLocalToday(tx, branchId);
  const todayUtc = dateOnlyToUtcDate(today);
  const currentMonthStart = dateOnlyToUtcDate(`${today.slice(0, 7)}-01`);

  const series = await tx.class_series.findMany({
    where: {
      discipline_id: disciplineId,
      period_month: { gte: currentMonthStart },
    },
    select: { id: true },
  });
  const upcomingOneTimeClasses = await tx.one_time_classes.findMany({
    where: {
      discipline_id: disciplineId,
      class_date: { gte: todayUtc },
    },
    select: { id: true },
  });

  let removed = 0;

  if (series.length > 0) {
    const result = await tx.class_series_students.deleteMany({
      where: {
        series_id: { in: series.map((row) => row.id) },
        student_id: studentId,
      },
    });
    removed += result.count;
  }

  if (upcomingOneTimeClasses.length > 0) {
    const result = await tx.one_time_class_students.deleteMany({
      where: {
        one_time_class_id: { in: upcomingOneTimeClasses.map((row) => row.id) },
        student_id: studentId,
      },
    });
    removed += result.count;
  }

  return removed;
}
