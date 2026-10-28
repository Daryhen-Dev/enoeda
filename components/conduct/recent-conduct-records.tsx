import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { CONDUCT_KINDS, CONDUCT_STATUSES } from "@/lib/domain/conduct"
import type { RecentConductRecord } from "@/lib/domain/conduct"
import {
  CONDUCT_MESSAGES,
  CONDUCT_QUICK_ENTRY_MESSAGES,
  CONDUCT_RECORDS_MESSAGES,
  formatCurrency,
  formatDateOnlyValue,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

export type RecentConductRecordView = RecentConductRecord

interface RecentConductRecordsProps {
  /** Newest first, as returned by listBranchConductRecords. */
  records: RecentConductRecordView[]
  branchId: string
  /** Set when loading the records shown failed. */
  initialError?: string
  /** Section heading; defaults to "Últimos registros". */
  title?: string
  /** Empty-state title; defaults to the branch-level message. */
  emptyTitle?: string
  /** Renders a loading line instead of the empty state while fetching. */
  loading?: boolean
}

/**
 * Branch-level records list of the Conducta page. Read-only: per-record
 * actions (mark paid, void) live on the student detail page. Voided records
 * render muted with their void reason. The heading and the empty-state title
 * are overridable so a list narrowed to one student can name that student.
 */
export function RecentConductRecords({
  records,
  branchId,
  initialError,
  title,
  emptyTitle,
  loading = false,
}: RecentConductRecordsProps) {
  const heading = title ?? CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_TITLE

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{heading}</h2>

      {initialError ? (
        <p role="alert" className="text-sm text-destructive">
          {initialError}
        </p>
      ) : loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_LOADING}
        </p>
      ) : records.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {emptyTitle ?? CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_EMPTY}
            </EmptyTitle>
            <EmptyDescription>
              {CONDUCT_MESSAGES.REGISTER_ACTION}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          aria-label={title ?? CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_LIST_ARIA_LABEL}
          className="grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2"
        >
          {records.map((record) => {
            const isVoided = record.voided_at !== null
            const isFine = record.kind === CONDUCT_KINDS.FINE
            const isPaidFine =
              isFine && record.status === CONDUCT_STATUSES.PAID

            return (
              <li
                key={record.id}
                className={cn(
                  "flex flex-col gap-1 rounded-md border p-3",
                  isVoided && "bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/students/${record.student.id}?branch=${branchId}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {record.student.surname} {record.student.first_name}
                  </Link>
                  <Badge
                    variant={isFine ? "default" : "outline"}
                    className="text-xs"
                  >
                    {isFine
                      ? CONDUCT_MESSAGES.KIND_FINE
                      : CONDUCT_MESSAGES.KIND_WARNING}
                  </Badge>
                  {isFine && !isVoided && (
                    <Badge variant="outline" className="text-xs">
                      {isPaidFine
                        ? CONDUCT_MESSAGES.STATUS_PAID
                        : CONDUCT_MESSAGES.STATUS_PENDING}
                    </Badge>
                  )}
                  {isVoided && (
                    <Badge variant="outline" className="text-xs">
                      {CONDUCT_MESSAGES.VOIDED_BADGE}
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-2 text-sm">{record.reason}</p>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    {CONDUCT_MESSAGES.INCIDENT_DATE_LABEL}:{" "}
                    {formatDateOnlyValue(new Date(record.incident_date))}
                  </span>
                  {isFine && !isVoided && record.amount !== null && (
                    <span>
                      {CONDUCT_MESSAGES.AMOUNT_LABEL}:{" "}
                      {formatCurrency(record.amount)}
                    </span>
                  )}
                  {isVoided && record.void_reason !== null && (
                    <span>
                      {CONDUCT_MESSAGES.VOIDED_WITH_REASON(record.void_reason)}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
