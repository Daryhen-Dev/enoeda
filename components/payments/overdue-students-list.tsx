"use client"
import type { ColumnDef, TableFeatures } from "@tanstack/react-table"
import Link from "next/link"
import { DataTable } from "@/components/data-table"
import { RegisterMonthlyPaymentDialog } from "@/components/payments/register-monthly-payment-dialog"
import type { OverdueStudentRow } from "@/lib/domain/payments/queries"
import { formatDate, PAYMENT_CONSOLE_MESSAGES } from "@/lib/localization/es-ec"
interface OverdueStudentsListProps { students: OverdueStudentRow[]; branchId: string; canManage: boolean; canOpenStudents?: boolean }
function studentHref(studentId: string, branchId: string): string { return `/dashboard/students/${studentId}?${new URLSearchParams({ branch: branchId }).toString()}` }
export function OverdueStudentsList({ students, branchId, canManage, canOpenStudents = true }: OverdueStudentsListProps) {
  const columns: ColumnDef<TableFeatures, OverdueStudentRow>[] = [{ accessorKey: "student_name", header: PAYMENT_CONSOLE_MESSAGES.STUDENT, cell: ({ row }) => canOpenStudents ? <Link href={studentHref(row.original.student_id, branchId)} className="font-medium text-primary underline-offset-4 hover:underline">{row.original.student_name}</Link> : <span className="font-medium">{row.original.student_name}</span> }, { accessorKey: "discipline_name", header: PAYMENT_CONSOLE_MESSAGES.DISCIPLINE }, { accessorKey: "next_due_date", header: PAYMENT_CONSOLE_MESSAGES.DUE_DATE, cell: ({ row }) => formatDate(new Date(row.original.next_due_date)) }, ...(canManage ? [{ id: "actions", header: PAYMENT_CONSOLE_MESSAGES.ACTIONS, cell: ({ row }: { row: { original: OverdueStudentRow } }) => <RegisterMonthlyPaymentDialog studentDisciplineId={row.original.student_discipline_id} branchId={branchId} /> }] : [])]
  return <DataTable columns={columns} data={students} caption={PAYMENT_CONSOLE_MESSAGES.OVERDUE_CAPTION} emptyState={PAYMENT_CONSOLE_MESSAGES.EMPTY_OVERDUE} />
}
