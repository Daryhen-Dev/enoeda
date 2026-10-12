"use client"

import { Badge } from "@/components/ui/badge"
import { ConductRecordActions } from "@/components/students/conduct-record-actions"
import { CONDUCT_KINDS, CONDUCT_STATUSES } from "@/lib/domain/conduct"
import type { ConductRecord, ConductSummary } from "@/lib/domain/conduct"
import {
  CONDUCT_MESSAGES,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

interface StudentConductPanelProps {
  /** Records newest first, as returned by listStudentConductRecords. */
  records: ConductRecord[]
  summary: ConductSummary
  branchId: string
  canManage: boolean
}

/**
 * "Conducta" tab content of the student detail page: summary of pending
 * fines (count + total) and warnings, plus the record list. Voided records
 * render muted with their void reason. Row actions render only for viewers
 * who can manage and for non-voided records.
 */
export function StudentConductPanel({
  records,
  summary,
  branchId,
  canManage,
}: StudentConductPanelProps) {
  const summaryItems: string[] = []
  if (summary.pending_fines_count > 0) {
    summaryItems.push(
      CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(
        summary.pending_fines_count,
        formatCurrency(summary.pending_fines_total)
      )
    )
  }
  if (summary.warnings_count > 0) {
    summaryItems.push(CONDUCT_MESSAGES.SUMMARY_WARNINGS(summary.warnings_count))
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {CONDUCT_MESSAGES.PANEL_TITLE}
      </h2>

      {summaryItems.length > 0 && (
        <div className="flex flex-col gap-1">
          {summaryItems.map((item) => (
            <p key={item} className="text-sm text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {CONDUCT_MESSAGES.EMPTY_STATE}
        </p>
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {records.map((record) => {
            const isVoided = record.voided_at !== null
            const isFine = record.kind === CONDUCT_KINDS.FINE
            const isPaidFine =
              isFine && record.status === CONDUCT_STATUSES.PAID

            return (
              <article
                key={record.id}
                className={cn(
                  "flex h-full flex-col gap-1 rounded-md border p-3",
                  isVoided && "bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
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
                <p className="text-sm">{record.reason}</p>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    {CONDUCT_MESSAGES.INCIDENT_DATE_LABEL}:{" "}
                    {formatDate(new Date(record.incident_date))}
                  </span>
                  {isFine && record.amount !== null && (
                    <span>
                      {CONDUCT_MESSAGES.AMOUNT_LABEL}:{" "}
                      {formatCurrency(record.amount)}
                    </span>
                  )}
                  {isPaidFine && record.paid_at !== null && (
                    <span>
                      {CONDUCT_MESSAGES.PAID_AT_LABEL}:{" "}
                      {formatDateTime(new Date(record.paid_at))}
                    </span>
                  )}
                  {isVoided && record.void_reason !== null && (
                    <span>
                      {CONDUCT_MESSAGES.VOIDED_WITH_REASON(record.void_reason)}
                    </span>
                  )}
                </div>
                {canManage && !isVoided && (
                  <ConductRecordActions record={record} branchId={branchId} />
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
