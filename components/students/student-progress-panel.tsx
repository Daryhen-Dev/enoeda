import { Badge } from "@/components/ui/badge"
import type {
  ProgressRecord,
  StudentProgressSummary,
} from "@/lib/domain/progress/actions"
import {
  formatDate,
  formatNumber,
  PROGRESS_MESSAGES,
} from "@/lib/localization/es-ec"

interface StudentProgressPanelProps {
  progress: ProgressRecord[]
  summaries: StudentProgressSummary[]
}

export function StudentProgressPanel({
  progress,
  summaries,
}: StudentProgressPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {PROGRESS_MESSAGES.PANEL_TITLE}
      </h2>

      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {PROGRESS_MESSAGES.NO_PROGRESS}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {summaries.map((summary) => (
            <article
              key={summary.discipline_id}
              className="overflow-x-auto rounded-lg border bg-card p-3"
            >
              <div className="flex min-w-max items-center gap-4 whitespace-nowrap">
                <h3 className="text-sm font-medium">{summary.discipline_name}</h3>

                {summary.current_level_name ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {PROGRESS_MESSAGES.CURRENT_LEVEL}:
                    </span>
                    <Badge variant="outline" className="gap-1.5">
                      {summary.current_level_color && (
                        <span
                          aria-hidden="true"
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: summary.current_level_color }}
                        />
                      )}
                      {summary.current_level_name}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {PROGRESS_MESSAGES.NO_LEVEL_ASSIGNED}
                  </p>
                )}

                {summary.current_level_name && summary.next_level_name && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {PROGRESS_MESSAGES.NEXT_LEVEL}:
                    </span>
                    {summary.next_level_color && (
                      <span
                        aria-hidden="true"
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: summary.next_level_color }}
                      />
                    )}
                    <span>{summary.next_level_name}</span>
                  </div>
                )}

                {summary.is_max_level && (
                  <p className="text-sm font-medium">
                    {PROGRESS_MESSAGES.MAX_LEVEL}
                  </p>
                )}

                {summary.current_level_name && (
                  <p className="text-sm text-muted-foreground">
                    {summary.is_max_level
                      ? PROGRESS_MESSAGES.ACCUMULATED_CLASSES(
                          formatNumber(summary.attended_sessions)
                        )
                      : PROGRESS_MESSAGES.CLASSES_TO_NEXT_LEVEL(
                          formatNumber(summary.attended_sessions),
                          formatNumber(summary.next_level_required_sessions ?? 0)
                        )}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {progress.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            {PROGRESS_MESSAGES.TIMELINE_TITLE}
          </h3>
          <div className="flex flex-col gap-1.5">
            {progress.map((record) => (
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
        </div>
      )}
    </section>
  )
}
