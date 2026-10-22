/**
 * Long Spanish (Ecuador) label for a calendar date: "Lunes, 19 de octubre".
 *
 * `dateOnly` is already the branch-local calendar date ("YYYY-MM-DD"), so it
 * is anchored at UTC midnight and formatted in UTC. Formatting it in the
 * branch zone (UTC-5) would shift UTC midnight back to the previous day.
 */
export function formatOverviewDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-").map(Number)
  const label = new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)))

  return label.charAt(0).toUpperCase() + label.slice(1)
}
