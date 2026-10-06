"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { ProgressRecord } from "@/lib/domain/progress/actions"
import {
  formatDate,
  formatNumber,
  PROGRESS_MESSAGES,
  STUDENT_DETAIL_MESSAGES,
} from "@/lib/localization/es-ec"

interface StudentProgressPanelProps {
  progress: ProgressRecord[]
  /**
   * Maximum entries shown before the "Ver todo" toggle. When omitted the
   * full list renders (legacy behavior for other call sites).
   */
  visibleCount?: number
}

/**
 * Promotion timeline for the student detail page. The per-discipline
 * progression summaries live in the discipline cards; this panel keeps
 * only the chronological promotion history.
 */
export function StudentProgressPanel({
  progress,
  visibleCount,
}: StudentProgressPanelProps) {
  const [showAll, setShowAll] = useState(false)

  const isBounded =
    visibleCount !== undefined && progress.length > visibleCount
  const visibleProgress =
    isBounded && !showAll ? progress.slice(0, visibleCount) : progress

  return (
    <section className="flex flex-col gap-3">
      {progress.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {PROGRESS_MESSAGES.NO_PROGRESS}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            {PROGRESS_MESSAGES.TIMELINE_TITLE}
          </h3>
          <div className="flex flex-col gap-1.5">
            {visibleProgress.map((record) => (
              <div key={record.id} className="flex items-center gap-2 text-xs">
                {record.level_color && (
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: record.level_color }}
                  />
                )}
                <span className="font-medium">{record.level_name}</span>
                <span className="text-muted-foreground">
                  ({record.discipline_name})
                </span>
                <span className="text-muted-foreground">
                  {formatDate(new Date(record.promoted_at))}
                </span>
                {record.observations && (
                  <span className="truncate text-muted-foreground">
                    — {record.observations}
                  </span>
                )}
              </div>
            ))}
          </div>
          {isBounded && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll
                  ? STUDENT_DETAIL_MESSAGES.VIEW_LESS_ACTION
                  : STUDENT_DETAIL_MESSAGES.VIEW_ALL_ACTION(
                      formatNumber(progress.length)
                    )}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
