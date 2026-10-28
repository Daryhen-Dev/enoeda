import { BeltChip } from "@/components/belts/belt-chip"
import { Badge } from "@/components/ui/badge"
import {
  STUDENT_ACTIVATION_STATUS,
  type StudentListItem,
} from "@/lib/domain/students"
import { STUDENT_LIFECYCLE_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Belt swatches of one directory record: one hairline strip per active
 * discipline that has a recorded level, filled from `discipline_levels.color`.
 * A discipline without a level renders nothing (never an empty hairline), and
 * the accessible name pairs the level with its discipline so the swatch means
 * something without seeing the color.
 *
 * Shared by the table row and the mobile card so both tell the same story.
 */
export function StudentBeltSwatches({ student }: { student: StudentListItem }) {
  const belts = student.active_disciplines.flatMap((discipline) =>
    discipline.level_name === null
      ? []
      : [{ discipline, levelName: discipline.level_name }]
  )

  if (belts.length === 0) return null

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {belts.map(({ discipline, levelName }) => {
        const label = `${levelName} — ${discipline.discipline_name}`

        return (
          <span
            key={discipline.id}
            role="img"
            aria-label={label}
            title={label}
            className="flex items-center"
          >
            <BeltChip levelName={null} levelColor={discipline.level_color} />
          </span>
        )
      })}
    </span>
  )
}

/**
 * Only a record still pending activation says so: an activated record prints
 * nothing, instead of the old always-on "Activado" text.
 */
export function StudentPendingActivationBadge({
  student,
}: {
  student: StudentListItem
}) {
  if (student.activation_status !== STUDENT_ACTIVATION_STATUS.PENDING) {
    return null
  }

  return (
    <Badge variant="secondary">
      {STUDENT_LIFECYCLE_MESSAGES.PENDING_ACTIVATION_STATUS}
    </Badge>
  )
}
