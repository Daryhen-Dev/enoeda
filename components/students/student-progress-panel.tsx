"use client"

import { Badge } from "@/components/ui/badge"
import type { ProgressRecord } from "@/lib/domain/progress/actions"
import { PROGRESS_MESSAGES } from "@/lib/localization/es-ec"
import { formatDate } from "@/lib/localization/es-ec"

interface StudentProgressPanelProps {
  progress: ProgressRecord[]
  canPromote: boolean
}

/**
 * Derives the current level per discipline from progress records.
 * Current level = first row per discipline group (records ordered by promoted_at desc).
 */
function getCurrentLevels(progress: ProgressRecord[]) {
  const seen = new Set<string>()
  const current: ProgressRecord[] = []
  for (const record of progress) {
    if (!seen.has(record.discipline_id)) {
      seen.add(record.discipline_id)
      current.push(record)
    }
  }
  return current
}

export function StudentProgressPanel({
  progress,
  canPromote,
}: StudentProgressPanelProps) {
  const currentLevels = getCurrentLevels(progress)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {PROGRESS_MESSAGES.PANEL_TITLE}
      </h2>

      {currentLevels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {PROGRESS_MESSAGES.NO_PROGRESS}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Current levels per discipline */}
          <div className="flex flex-wrap gap-2">
            {currentLevels.map((record) => (
              <div
                key={record.discipline_id}
                className="flex items-center gap-1.5"
              >
                <span className="text-xs text-muted-foreground">
                  {record.discipline_name}:
                </span>
                <Badge
                  variant="outline"
                  className="gap-1.5"
                >
                  {record.level_color && (
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: record.level_color }}
                    />
                  )}
                  {record.level_name}
                </Badge>
              </div>
            ))}
          </div>

          {/* Promotion timeline */}
          {progress.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">
                {PROGRESS_MESSAGES.TIMELINE_TITLE}
              </h3>
              <div className="flex flex-col gap-1.5">
                {progress.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    {record.level_color && (
                      <span
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
            </div>
          )}
        </div>
      )}

      {/* canPromote is exposed for parent to render the promotion dialog trigger */}
      {canPromote && currentLevels.length > 0 && (
        <div data-slot="promote-trigger-area" />
      )}
    </section>
  )
}
