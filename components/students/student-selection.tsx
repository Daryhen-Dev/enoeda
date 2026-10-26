"use client"

import { PowerOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { STUDENT_BULK_ACTIONS_MESSAGES } from "@/lib/localization/es-ec"

interface StudentSelectionBarProps {
  count: number
  /** Opens the shared bulk confirmation dialog. */
  onRequestDeactivate: () => void
  onClear: () => void
}

/**
 * Selection bar of the students directory (S4): how many rows are selected and
 * the only two things a selection is good for — deactivate them in one action,
 * or drop the selection. Renders nothing while the selection is empty, so the
 * directory never shows a dead control.
 */
export function StudentSelectionBar({
  count,
  onRequestDeactivate,
  onClear,
}: StudentSelectionBarProps) {
  if (count === 0) {
    return null
  }

  return (
    <div
      role="region"
      aria-label={STUDENT_BULK_ACTIONS_MESSAGES.SELECTION_BAR_LABEL}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2"
    >
      <p role="status" aria-live="polite" className="text-sm font-medium">
        {STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(count)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onRequestDeactivate}
        >
          <PowerOffIcon aria-hidden="true" />
          {STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {STUDENT_BULK_ACTIONS_MESSAGES.CLEAR_SELECTION}
        </Button>
      </div>
    </div>
  )
}
