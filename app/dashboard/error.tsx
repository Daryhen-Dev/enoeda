"use client"

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Section error boundary for the authenticated shell. A failed server render
 * used to reach the user as the framework overlay or a dead screen; this keeps
 * them inside the app with one recovery action, without printing the raw error
 * stack on a phone at the mat.
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 md:p-6"
      >
        <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-[-0.01em]">
            {SECTION_FEEDBACK_MESSAGES.ERROR_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {SECTION_FEEDBACK_MESSAGES.ERROR_DESCRIPTION}
          </p>
        </div>
        <Button type="button" onClick={() => reset()}>
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          {SECTION_FEEDBACK_MESSAGES.ERROR_RETRY}
        </Button>
        <p className="text-xs text-muted-foreground">
          {SECTION_FEEDBACK_MESSAGES.ERROR_HINT}
        </p>
      </section>
    </main>
  )
}
