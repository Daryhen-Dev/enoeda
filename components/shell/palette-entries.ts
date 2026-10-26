import type { LucideIcon } from "lucide-react"
import { CornerDownRightIcon, UserRoundIcon } from "lucide-react"

import {
  buildNavigationHref,
  getVisibleNavigationItems,
  type NavigationItem,
} from "@/components/app-sidebar"
import type { StudentListItem } from "@/lib/domain/students"
import {
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_SEARCH_MESSAGES,
} from "@/lib/localization/es-ec"

/**
 * One palette list holds two kinds of rows: a record to open (student) and a
 * destination to jump to (section). Both carry a ready-to-use href, so the
 * dialog never decides where to go.
 */
export interface PaletteSectionEntry {
  kind: "section"
  /** Stable key: the section route. */
  id: string
  label: string
  /** Muted line under the label. */
  meta: string
  href: string
  icon: LucideIcon
}

export type PaletteStudentRow = Pick<
  { student: StudentListItem; isActive: boolean },
  "student" | "isActive"
>

export interface PaletteStudentEntry {
  kind: "student"
  id: string
  label: string
  meta: string
  /** Status word shown at the trailing edge. */
  badge: string
  href: string
  icon: LucideIcon
}

export type PaletteEntry = PaletteSectionEntry | PaletteStudentEntry

interface SectionFlags {
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

/** Lowercase and strip diacritics so "Cédula" and "cedula" match the same rows. */
export function normalizePaletteText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Every destination the caller can reach, taken from the sidebar list so the
 * palette can never offer a section the rail hides.
 */
export function buildSectionEntries(
  items: NavigationItem[],
  branchId: string | null,
  flags: SectionFlags
): PaletteSectionEntry[] {
  return getVisibleNavigationItems(flags).map((item) => ({
    kind: "section" as const,
    id: item.url,
    label: item.title,
    meta: STUDENT_SEARCH_MESSAGES.SECTION_META,
    href: buildNavigationHref(item.url, item.branchScoped, branchId),
    icon: item.icon,
  }))
}

/** Matches on any word of the label; an empty query lists them all. */
export function filterSectionEntries(
  entries: PaletteSectionEntry[],
  query: string
): PaletteSectionEntry[] {
  const needle = normalizePaletteText(query)
  if (needle.length === 0) return entries

  return entries.filter((entry) =>
    normalizePaletteText(entry.label).includes(needle)
  )
}

function studentName(student: StudentListItem): string {
  return `${student.first_name} ${student.surname}`
}

/** Students keep the branch they were found in, so the detail page cannot drift. */
export function buildStudentEntries(
  rows: PaletteStudentRow[],
  branchId: string | null
): PaletteStudentEntry[] {
  return rows.map(({ student, isActive }) => {
    const targetBranch = branchId ?? student.branch_id
    const disciplines =
      student.active_discipline_names.length > 0
        ? student.active_discipline_names.join(", ")
        : STUDENT_DIRECTORY_MESSAGES.NO_ACTIVE_DISCIPLINES

    return {
      kind: "student" as const,
      id: student.id,
      label: studentName(student),
      meta: student.national_id
        ? `${disciplines} · ${student.national_id}`
        : disciplines,
      badge: isActive
        ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS
        : STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS,
      href: `/dashboard/students/${student.id}?branch=${encodeURIComponent(targetBranch)}`,
      icon: UserRoundIcon,
    }
  })
}

export const SECTION_ENTRY_ICON_FALLBACK: LucideIcon = CornerDownRightIcon
