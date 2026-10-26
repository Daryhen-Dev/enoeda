"use client"

import { SearchIcon } from "lucide-react"

import { OPEN_STUDENT_SEARCH_EVENT } from "@/components/shell/student-search-event"
import { STUDENT_SEARCH_MESSAGES } from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

/**
 * Header control for the student search palette. It only dispatches the open
 * event: the palette lives in the dashboard layout, so the header stays free of
 * the search action and of any palette state.
 */
export function StudentSearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_STUDENT_SEARCH_EVENT))}
      aria-label={STUDENT_SEARCH_MESSAGES.TRIGGER_LABEL}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className
      )}
    >
      <SearchIcon className="size-4" aria-hidden="true" />
      {/* A phone has no Ctrl+K, so the control must read as a search box, not
          as an unlabeled magnifier. */}
      <span className="lg:hidden">
        {STUDENT_SEARCH_MESSAGES.TRIGGER_LABEL_SHORT}
      </span>
      <span className="hidden lg:inline">
        {STUDENT_SEARCH_MESSAGES.TRIGGER_LABEL}
      </span>
      <kbd className="hidden rounded border border-border px-1 text-[0.65rem] lg:inline">
        Ctrl K
      </kbd>
    </button>
  )
}
