import type { EnrollmentEvent } from "@/lib/domain/disciplines/actions"
import { ENROLLMENT_MESSAGES, formatDate } from "@/lib/localization/es-ec"

interface EnrollmentHistoryProps {
  events: EnrollmentEvent[]
}

const EVENT_LABELS: Record<EnrollmentEvent["event_type"], string> = {
  enrolled: ENROLLMENT_MESSAGES.EVENT_ENROLLED,
  suspended: ENROLLMENT_MESSAGES.EVENT_SUSPENDED,
  reactivated: ENROLLMENT_MESSAGES.EVENT_REACTIVATED,
}

export function EnrollmentHistory({ events }: EnrollmentHistoryProps) {
  if (events.length === 0) {
    return null
  }

  return (
    <section aria-label={ENROLLMENT_MESSAGES.HISTORY_TITLE}>
      <h2 className="mb-3 text-lg font-semibold">
        {ENROLLMENT_MESSAGES.HISTORY_TITLE}
      </h2>
      <ol className="flex flex-col gap-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
          >
            <span className="font-medium">
              {EVENT_LABELS[event.event_type]}
            </span>
            <span className="text-muted-foreground">
              {formatDate(new Date(event.event_date))}
            </span>
            {event.notes && (
              <span className="text-muted-foreground italic">
                {event.notes}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
