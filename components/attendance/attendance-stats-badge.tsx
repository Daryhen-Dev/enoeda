import { Badge } from "@/components/ui/badge"
import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec"

interface AttendanceStatsBadgeProps {
  present: number
  total: number
  percentage: number
}

export function AttendanceStatsBadge({
  present,
  total,
  percentage,
}: AttendanceStatsBadgeProps) {
  if (total === 0) return null

  return (
    <Badge variant="secondary" className="text-xs">
      {ATTENDANCE_FORM_MESSAGES.STATS_LABEL}: {percentage}% ({present}/{total})
    </Badge>
  )
}
