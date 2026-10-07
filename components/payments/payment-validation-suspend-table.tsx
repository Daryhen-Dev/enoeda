"use client"

import { useState } from "react"
import Link from "next/link"

import { PaymentValidationSuspendDialog } from "@/components/payments/payment-validation-suspend-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { parseDateOnly } from "@/lib/date"
import type { MonthlyPaymentValidationRow } from "@/lib/domain/payments/validation-actions"
import {
  formatDate,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec"

interface PaymentValidationSuspendTableProps {
  rows: MonthlyPaymentValidationRow[]
  branchId: string
}

/**
 * Interactive section for enrollments past the grace period: multi-select
 * rows, select-all with indeterminate state, and a confirmation dialog that
 * bulk-suspends the selected enrollments for non-payment.
 */
export function PaymentValidationSuspendTable({
  rows,
  branchId,
}: PaymentValidationSuspendTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Derive header state from rows actually present, so ids that vanished after
  // a revalidation never make the header read as fully selected.
  const selectedRows = rows.filter((row) =>
    selectedIds.includes(row.student_discipline_id)
  )
  const isAllSelected = rows.length > 0 && selectedRows.length === rows.length
  const isPartiallySelected = selectedRows.length > 0 && !isAllSelected

  function toggleAll(nextChecked: boolean) {
    setSelectedIds(nextChecked ? rows.map((row) => row.student_discipline_id) : [])
  }

  function toggleRow(studentDisciplineId: string, nextChecked: boolean) {
    setSelectedIds((previous) =>
      nextChecked
        ? [...previous, studentDisciplineId]
        : previous.filter((id) => id !== studentDisciplineId)
    )
  }

  function handleSuspended() {
    setIsDialogOpen(false)
    setSelectedIds([])
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND_EMPTY}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableCaption>
          {PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND_CAPTION}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                aria-label={PAYMENT_VALIDATION_MESSAGES.SELECT_ALL_ARIA}
                checked={isAllSelected}
                indeterminate={isPartiallySelected}
                onCheckedChange={(checked) => toggleAll(checked)}
              />
            </TableHead>
            <TableHead>{PAYMENT_VALIDATION_MESSAGES.STUDENT}</TableHead>
            <TableHead>{PAYMENT_VALIDATION_MESSAGES.DISCIPLINE}</TableHead>
            <TableHead>{PAYMENT_VALIDATION_MESSAGES.DUE_DATE}</TableHead>
            <TableHead>{PAYMENT_VALIDATION_MESSAGES.DAYS_OVERDUE}</TableHead>
            <TableHead>{PAYMENT_VALIDATION_MESSAGES.GRACE_DEADLINE}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.student_discipline_id}>
              <TableCell>
                <Checkbox
                  aria-label={PAYMENT_VALIDATION_MESSAGES.SELECT_ROW_ARIA(
                    row.student_name,
                    row.discipline_name
                  )}
                  checked={selectedIds.includes(row.student_discipline_id)}
                  onCheckedChange={(checked) =>
                    toggleRow(row.student_discipline_id, checked)
                  }
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/students/${row.student_id}?${new URLSearchParams({ branch: branchId }).toString()}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {row.student_name}
                </Link>
              </TableCell>
              <TableCell>{row.discipline_name}</TableCell>
              <TableCell>
                {row.next_due_date
                  ? formatDate(parseDateOnly(row.next_due_date))
                  : PAYMENT_VALIDATION_MESSAGES.FALLBACK_DASH}
              </TableCell>
              <TableCell>{row.days_overdue}</TableCell>
              <TableCell>
                {row.grace_deadline
                  ? formatDate(parseDateOnly(row.grace_deadline))
                  : PAYMENT_VALIDATION_MESSAGES.FALLBACK_DASH}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div>
        <Button
          variant="destructive"
          disabled={selectedRows.length === 0}
          onClick={() => setIsDialogOpen(true)}
        >
          {PAYMENT_VALIDATION_MESSAGES.SUSPEND_SELECTED(String(selectedRows.length))}
        </Button>
      </div>

      <PaymentValidationSuspendDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedRows={selectedRows}
        branchId={branchId}
        onSuspended={handleSuspended}
      />
    </div>
  )
}
