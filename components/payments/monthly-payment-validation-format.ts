import { USER_LOCALE } from "@/lib/localization/es-ec"

const MONTH_FORMAT_OPTIONS = {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions

/**
 * Formats the branch-local month ("YYYY-MM") as "month year" in es-EC. The
 * parts are interpreted as UTC so the month name never shifts with the
 * server's local time zone.
 */
export function formatMonthName(month: string): string {
  const [year, monthPart] = month.split("-").map(Number)
  return new Intl.DateTimeFormat(USER_LOCALE, MONTH_FORMAT_OPTIONS).format(
    new Date(Date.UTC(year, monthPart - 1, 15))
  )
}

export function buildQuery(branchId: string): string {
  return new URLSearchParams({ branch: branchId }).toString()
}
