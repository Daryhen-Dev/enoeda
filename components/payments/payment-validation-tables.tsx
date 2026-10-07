import Link from "next/link"

import { Badge } from "@/components/ui/badge"
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
import type {
  MonthlyPaymentValidationRow,
  SuspendedThisMonthRow,
} from "@/lib/domain/payments/validation-actions"
import {
  formatDateTime,
  formatDate,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec"

interface ValidationTableProps {
  rows: MonthlyPaymentValidationRow[]
  branchId: string
}

interface SuspendedThisMonthTableProps {
  rows: SuspendedThisMonthRow[]
  branchId: string
  /** Branch IANA time zone used to display suspension timestamps. */
  timeZone: string
}

export function studentHref(studentId: string, branchId: string): string {
  return `/dashboard/students/${studentId}?${new URLSearchParams({ branch: branchId }).toString()}`
}

function StudentLink({ row, branchId }: { row: MonthlyPaymentValidationRow | SuspendedThisMonthRow; branchId: string }) {
  return (
    <Link
      href={studentHref(row.student_id, branchId)}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {row.student_name}
    </Link>
  )
}

function formatDueDate(value: string | null): string {
  return value ? formatDate(parseDateOnly(value)) : PAYMENT_VALIDATION_MESSAGES.NO_PAYMENTS_REGISTERED
}

/**
 * Read-only table for enrollments past the grace period. Selection and the
 * suspend action live in the client suspend table component.
 */
export function PaymentValidationInGraceTable({ rows, branchId }: ValidationTableProps) {
  return (
    <Table>
      <TableCaption>{PAYMENT_VALIDATION_MESSAGES.IN_GRACE_CAPTION}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.STUDENT}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.DISCIPLINE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.DUE_DATE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.DAYS_OVERDUE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.GRACE_DEADLINE}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground">
              {PAYMENT_VALIDATION_MESSAGES.IN_GRACE_EMPTY}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.student_discipline_id}>
              <TableCell>
                <StudentLink row={row} branchId={branchId} />
              </TableCell>
              <TableCell>{row.discipline_name}</TableCell>
              <TableCell>
                {row.next_due_date
                  ? formatDate(parseDateOnly(row.next_due_date))
                  : PAYMENT_VALIDATION_MESSAGES.FALLBACK_DASH}
              </TableCell>
              <TableCell>{row.days_overdue}</TableCell>
              <TableCell>{formatDueDate(row.grace_deadline)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

/**
 * Read-only table for non-payment suspensions recorded during the current
 * branch-local month.
 */
export function PaymentValidationSuspendedThisMonthTable({ rows, branchId, timeZone }: SuspendedThisMonthTableProps) {
  return (
    <Table>
      <TableCaption>{PAYMENT_VALIDATION_MESSAGES.SUSPENDED_MONTH_CAPTION}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.STUDENT}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.DISCIPLINE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.SUSPENDED_DATE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.PERFORMED_BY}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.CURRENT_STATE}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground">
              {PAYMENT_VALIDATION_MESSAGES.SUSPENDED_MONTH_EMPTY}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.student_discipline_id}>
              <TableCell>
                <StudentLink row={row} branchId={branchId} />
              </TableCell>
              <TableCell>{row.discipline_name}</TableCell>
              <TableCell>{formatDateTime(new Date(row.suspended_at), timeZone)}</TableCell>
              <TableCell>{row.performed_by_name ?? PAYMENT_VALIDATION_MESSAGES.FALLBACK_DASH}</TableCell>
              <TableCell>
                <Badge variant={row.currently_suspended ? "destructive" : "outline"}>
                  {row.currently_suspended
                    ? PAYMENT_VALIDATION_MESSAGES.SUSPENDED_BADGE
                    : PAYMENT_VALIDATION_MESSAGES.REACTIVATED_BADGE}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

/**
 * Read-only table for enrollments that are up to date with their payments.
 */
export function PaymentValidationUpToDateTable({ rows, branchId }: ValidationTableProps) {
  return (
    <Table>
      <TableCaption>{PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE_CAPTION}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.STUDENT}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.DISCIPLINE}</TableHead>
          <TableHead>{PAYMENT_VALIDATION_MESSAGES.NEXT_DUE_DATE}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-muted-foreground">
              {PAYMENT_VALIDATION_MESSAGES.UP_TO_DATE_EMPTY}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.student_discipline_id}>
              <TableCell>
                <StudentLink row={row} branchId={branchId} />
              </TableCell>
              <TableCell>{row.discipline_name}</TableCell>
              <TableCell>{formatDueDate(row.next_due_date)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
