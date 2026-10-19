import { LoaderCircleIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

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
        <Skeleton className="h-5 w-40" />
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
            Cargando el panel de control...
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <h1 id="dashboard-loading-heading" className="text-lg font-semibold">
            Hoy
          </h1>
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <PanelSkeleton
            label="Clases de hoy"
            rowCount={AGENDA_SKELETON_ROW_COUNT}
          />
        </div>
        <div className="lg:col-span-5">
          <PanelSkeleton
            label="Pagos que requieren acción"
            rowCount={PAYMENTS_SKELETON_ROW_COUNT}
          />
        </div>
      </div>
    </main>
  )
}
