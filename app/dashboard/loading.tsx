import { LoaderCircleIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  CALENDAR_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
} from "@/lib/localization/es-ec"

const AGENDA_SKELETON_ROW_COUNT = 4
const PAYMENTS_SKELETON_ROW_COUNT = 3

/** Ledger-panel skeleton shared by both work areas of the overview. */
function PanelSkeleton({
  label,
  rowCount,
}: {
  label: string
  rowCount: number
}) {
  return (
    <section aria-label={label} className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 md:px-5">
        <Skeleton className="h-7 w-40" />
      </div>
      <div aria-hidden="true" className="flex flex-col px-4 py-1.5 md:px-5">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 border-b border-border py-3"
          >
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 md:px-5">
        <Skeleton className="h-4 w-28" />
      </div>
    </section>
  )
}

export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-labelledby="dashboard-loading-heading"
      className="flex flex-col gap-4 p-4 md:gap-6 md:p-6"
    >
      <header className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 text-muted-foreground"
          role="status"
        >
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
          <span className="text-sm font-medium">
            {DASHBOARD_OVERVIEW_MESSAGES.LOADING_OVERVIEW}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <h2
            id="dashboard-loading-heading"
            className="text-lg font-semibold tracking-[-0.01em]"
          >
            {CALENDAR_MESSAGES.TODAY}
          </h2>
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-7">
          <PanelSkeleton
            label={DASHBOARD_OVERVIEW_MESSAGES.TODAY_CLASSES}
            rowCount={AGENDA_SKELETON_ROW_COUNT}
          />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <PanelSkeleton
            label={DASHBOARD_OVERVIEW_MESSAGES.PAYMENTS_ACTION_TITLE}
            rowCount={PAYMENTS_SKELETON_ROW_COUNT}
          />
        </div>
      </div>
    </main>
  )
}
