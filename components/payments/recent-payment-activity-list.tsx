"use client"
import type { ColumnDef, TableFeatures } from "@tanstack/react-table"
import Link from "next/link"
import { DataTable } from "@/components/data-table"
import { PAYMENT_ACTIVITY_TYPES, type MonthlyPaymentActivity } from "@/lib/domain/payments/queries"
import { formatDate, PAYMENT_CONSOLE_MESSAGES, PAYMENT_MESSAGES, USER_LOCALE } from "@/lib/localization/es-ec"
const USD_FORMAT_OPTIONS = { style: "currency", currency: PAYMENT_CONSOLE_MESSAGES.CURRENCY_CODE } as const satisfies Intl.NumberFormatOptions
interface RecentPaymentActivityListProps { activity: MonthlyPaymentActivity[]; branchId: string; canOpenStudents?: boolean }
function studentHref(studentId: string, branchId: string): string { return `/dashboard/students/${studentId}?${new URLSearchParams({ branch: branchId }).toString()}` }
function formatUsd(value: number): string { return new Intl.NumberFormat(USER_LOCALE, USD_FORMAT_OPTIONS).format(value) }
export function RecentPaymentActivityList({ activity, branchId, canOpenStudents = true }: RecentPaymentActivityListProps) {
  const columns: ColumnDef<TableFeatures, MonthlyPaymentActivity>[] = [{ accessorKey: "student_name", header: PAYMENT_CONSOLE_MESSAGES.STUDENT, cell: ({ row }) => canOpenStudents ? <Link href={studentHref(row.original.student_id, branchId)} className="font-medium text-primary underline-offset-4 hover:underline">{row.original.student_name}</Link> : <span className="font-medium">{row.original.student_name}</span> }, { accessorKey: "discipline_name", header: PAYMENT_CONSOLE_MESSAGES.DISCIPLINE }, { accessorKey: "activity_date", header: PAYMENT_CONSOLE_MESSAGES.DATE, cell: ({ row }) => formatDate(new Date(row.original.activity_date)) }, { accessorKey: "amount", header: PAYMENT_CONSOLE_MESSAGES.AMOUNT, cell: ({ row }) => formatUsd(row.original.amount) }, { accessorKey: "type", header: PAYMENT_CONSOLE_MESSAGES.TYPE, cell: ({ row }) => row.original.type === PAYMENT_ACTIVITY_TYPES.MONTHLY ? PAYMENT_MESSAGES.TYPE_MONTHLY : PAYMENT_MESSAGES.TYPE_CLASS }]
  return <DataTable columns={columns} data={activity} caption={PAYMENT_CONSOLE_MESSAGES.ACTIVITY_CAPTION} emptyState={PAYMENT_CONSOLE_MESSAGES.EMPTY_ACTIVITY} />
}
