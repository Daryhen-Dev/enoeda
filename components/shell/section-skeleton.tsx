import { Skeleton } from "@/components/ui/skeleton"
import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Loading placeholder shared by the dashboard section boundaries. Each variant
 * mirrors the destination layout closely enough that the real content lands
 * where the placeholder was: a bordered panel, a data table, a detail page or
 * a calendar grid. Everything below the status line is decorative, so assistive
 * technology hears one "loading" announcement instead of a wall of boxes.
 */

export const SECTION_SKELETON_VARIANT = {
  PANEL: "panel",
  TABLE: "table",
  DETAIL: "detail",
  CALENDAR: "calendar",
} as const

export type SectionSkeletonVariant =
  (typeof SECTION_SKELETON_VARIANT)[keyof typeof SECTION_SKELETON_VARIANT]

const DEFAULT_ROW_COUNT: Record<SectionSkeletonVariant, number> = {
  panel: 4,
  table: 6,
  detail: 3,
  calendar: 14,
}

interface SectionSkeletonProps {
  /** Destination section name, announced to assistive technology. */
  label: string
  variant?: SectionSkeletonVariant
  rowCount?: number
}

function PanelBody({ rowCount }: { rowCount: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 md:px-5">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex flex-col gap-4 px-4 py-3 md:px-5">
        {Array.from({ length: rowCount }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TableBodySkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  )
}

function DetailBody({ rowCount }: { rowCount: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

function CalendarBody({ rowCount }: { rowCount: number }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: rowCount }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  )
}

export function SectionSkeleton({
  label,
  variant = SECTION_SKELETON_VARIANT.PANEL,
  rowCount,
}: SectionSkeletonProps) {
  const rows = rowCount ?? DEFAULT_ROW_COUNT[variant]

  return (
    <main
      aria-busy="true"
      aria-label={SECTION_FEEDBACK_MESSAGES.LOADING_LABEL(label)}
      className="flex flex-col gap-4 p-4 md:gap-6 md:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <p role="status" className="sr-only">
        {SECTION_FEEDBACK_MESSAGES.LOADING_SECTION}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {variant === SECTION_SKELETON_VARIANT.TABLE && (
          <TableBodySkeleton rowCount={rows} />
        )}
        {variant === SECTION_SKELETON_VARIANT.PANEL && (
          <PanelBody rowCount={rows} />
        )}
        {variant === SECTION_SKELETON_VARIANT.DETAIL && (
          <DetailBody rowCount={rows} />
        )}
        {variant === SECTION_SKELETON_VARIANT.CALENDAR && (
          <CalendarBody rowCount={rows} />
        )}
      </div>
    </main>
  )
}
