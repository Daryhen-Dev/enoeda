/**
 * History tabs of the student detail page: the tab keys, their order, and the
 * `?tab=` deep-link mapping.
 *
 * Kept out of `components/students/student-history-tabs.tsx` on purpose: that
 * module is `"use client"`, so every export becomes a client reference and a
 * server page cannot call it. The detail page resolves the requested tab
 * server-side before rendering the client component.
 */

export type StudentHistoryTab =
  | "notes"
  | "conduct"
  | "payments"
  | "progress"
  | "enrollments";

/** Every tab the history section renders, in strip order. */
export const STUDENT_HISTORY_TABS: readonly StudentHistoryTab[] = [
  "notes",
  "conduct",
  "payments",
  "progress",
  "enrollments",
];

/** Spanish slugs accepted in shared links, mapped to their tab key. */
const STUDENT_HISTORY_TAB_ALIASES: Record<string, StudentHistoryTab> = {
  notas: "notes",
  conducta: "conduct",
  pagos: "payments",
  progreso: "progress",
  inscripciones: "enrollments",
};

/**
 * Maps the `?tab=` deep-link parameter of the detail page onto a history tab.
 * The canonical keys and their Spanish slugs are both accepted, so a link
 * shared from the directory (`?tab=conducta`) still reads in the product's
 * language. Anything unrecognised (a stale link, a typo, a missing value)
 * keeps the caller's default instead of breaking the page.
 */
export function resolveStudentHistoryTab(
  value: string | undefined,
  fallback: StudentHistoryTab
): StudentHistoryTab {
  if (value === undefined || value.length === 0) return fallback;

  const canonical = STUDENT_HISTORY_TABS.find((tab) => tab === value);
  if (canonical) return canonical;

  return STUDENT_HISTORY_TAB_ALIASES[value] ?? fallback;
}
