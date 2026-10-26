import { toast } from "sonner"

import { UNDO_MESSAGES } from "@/lib/localization/es-ec"

/**
 * How long the undo affordance stays on screen. Long enough that a teacher who
 * taps the wrong student at the mat can still recover without hunting for it,
 * short enough that the toast never becomes permanent furniture.
 */
export const UNDO_TOAST_DURATION_MS = 10_000

interface UndoableActionResult {
  success: boolean
  error?: string
}

export interface UndoableActionSpec {
  /** Success copy for the action that just happened. */
  message: string
  /** Confirmation shown after the inverse action succeeded. */
  undoneMessage: string
  /** Copy used when the inverse fails without its own message. */
  failedMessage: string
  /** Runs the inverse action; the caller re-asserts authorization server-side. */
  undo: () => Promise<UndoableActionResult>
}

async function runUndo(spec: UndoableActionSpec): Promise<void> {
  try {
    const result = await spec.undo()
    if (result.success) {
      toast.success(spec.undoneMessage)
      return
    }
    toast.error(result.error ?? spec.failedMessage)
  } catch {
    toast.error(spec.failedMessage)
  }
}

/**
 * Confirms a reversible administrative action with an undo affordance (S4).
 * Without it, deactivating a student or suspending a class only offered a
 * "no se puede deshacer" warning and no way back.
 */
export function showUndoableAction(spec: UndoableActionSpec): void {
  toast.success(spec.message, {
    duration: UNDO_TOAST_DURATION_MS,
    action: {
      label: UNDO_MESSAGES.UNDO_LABEL,
      onClick: () => {
        void runUndo(spec)
      },
    },
  })
}
