"use client"

import type { ColumnDef, TableFeatures } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import {
  PAYMENT_HISTORY_KIND,
  PaymentHistoryActions,
  type PaymentHistoryActionRecord,
} from "@/components/payments/payment-history-actions"
import type { ClassPaymentRecord, PaymentRecord } from "@/lib/domain/payments/actions"
import { formatDate, PAYMENT_MESSAGES } from "@/lib/localization/es-ec"

interface StudentPaymentHistoryProps {
  monthly: PaymentRecord[]
  perClass: ClassPaymentRecord[]
  branchId: string
  canManage: boolean
  paymentSettingsAvailable: boolean
  paymentEditWindowDays: number | null
}

interface CombinedPaymentEntry {
  id: string
  discipline_name: string
  amount: number
  date: Date
  type: string
  detail: string
  record: PaymentHistoryActionRecord
}

export function StudentPaymentHistory({
  monthly,
  perClass,
  branchId,
  canManage,
  paymentSettingsAvailable,
  paymentEditWindowDays,
}: StudentPaymentHistoryProps) {
  const entries: CombinedPaymentEntry[] = [
    ...monthly.map((payment) => ({
      id: payment.id,
      discipline_name: payment.discipline_name,
      amount: payment.amount,
      date: payment.payment_date,
      type: PAYMENT_MESSAGES.TYPE_MONTHLY,
      detail: `${payment.months_covered}m`,
      record: {
        id: payment.id,
        kind: PAYMENT_HISTORY_KIND.MONTHLY,
        amount: payment.amount,
        payment_date: payment.payment_date,
        class_date: payment.payment_date,
        period_start: payment.period_start,
        period_end: payment.period_end,
        created_at: payment.created_at,
        note: payment.note,
      },
    })),
    ...perClass.map((payment) => ({
      id: payment.id,
      discipline_name: payment.discipline_name,
      amount: payment.amount,
      date: payment.class_date,
      type: PAYMENT_MESSAGES.TYPE_CLASS,
      detail: "",
      record: {
        id: payment.id,
        kind: PAYMENT_HISTORY_KIND.CLASS,
        amount: payment.amount,
        payment_date: payment.class_date,
        class_date: payment.class_date,
        period_start: payment.class_date,
        period_end: payment.class_date,
        created_at: payment.created_at,
        note: null,
      },
    })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime())

  const columns: ColumnDef<TableFeatures, CombinedPaymentEntry>[] = [
    {
      id: "actions",
      header: PAYMENT_MESSAGES.ACTIONS_LABEL,
      cell: ({ row }) => (
        <PaymentHistoryActions
          record={row.original.record}
          branchId={branchId}
          canManage={canManage}
          paymentSettingsAvailable={paymentSettingsAvailable}
          paymentEditWindowDays={paymentEditWindowDays}
        />
      ),
    },
    {
      accessorKey: "date",
      header: PAYMENT_MESSAGES.PAYMENT_DATE_LABEL,
      cell: ({ row }) => formatDate(row.original.date),
    },
    { accessorKey: "discipline_name", header: PAYMENT_MESSAGES.DISCIPLINE_LABEL },
    {
      accessorKey: "amount",
      header: PAYMENT_MESSAGES.AMOUNT_LABEL,
      cell: ({ row }) => `$${row.original.amount.toFixed(2)}`,
    },
    {
      accessorKey: "type",
      header: PAYMENT_MESSAGES.TYPE_MONTHLY,
      cell: ({ row }) => row.original.detail
        ? `${row.original.type} (${row.original.detail})`
        : row.original.type,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={entries}
      caption={PAYMENT_MESSAGES.HISTORY_TITLE}
      emptyState={PAYMENT_MESSAGES.NO_PAYMENTS}
    />
  )
}
