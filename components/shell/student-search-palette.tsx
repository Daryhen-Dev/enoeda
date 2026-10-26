"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { navigationItems } from "@/components/app-sidebar"
import {
  buildSectionEntries,
  buildStudentEntries,
  filterSectionEntries,
  type PaletteEntry,
} from "@/components/shell/palette-entries"
import { OPEN_STUDENT_SEARCH_EVENT } from "@/components/shell/student-search-event"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  listStudents,
  STUDENT_STATUS,
  type StudentListItem,
} from "@/lib/domain/students"
import { STUDENT_SEARCH_MESSAGES } from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

export const STUDENT_SEARCH_DEBOUNCE_MS = 250
export const STUDENT_SEARCH_MIN_QUERY_LENGTH = 2
export const STUDENT_SEARCH_MAX_RESULTS = 8
const RESULTS_PER_STATUS = STUDENT_SEARCH_MAX_RESULTS / 2

interface PaletteStudentRow {
  student: StudentListItem
  isActive: boolean
}

type SearchStatus = "idle" | "loading" | "done" | "error"

interface StudentSearchPaletteProps {
  /** Sidebar visibility flags, so the palette offers exactly the rail's sections. */
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

/**
 * Global search and jump (S1 + navigation). Lives in the dashboard layout so it
 * survives every navigation; opens from Ctrl/Cmd+K or from the header control.
 * With an empty field it lists the destinations the caller can reach, so the
 * shortcut is useful before you know what to type; typing searches the active
 * branch's students by name or cédula. A failed search never navigates.
 */
export function StudentSearchPalette({
  isAdmin,
  canManageProfile,
  isTeacherOnly,
}: StudentSearchPaletteProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branchId = searchParams.get("branch")
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  /**
   * Last completed search, tagged with the query it answered. Everything shown
   * is derived from it, so a short query needs no state reset and the search
   * effect never calls setState synchronously.
   */
  const [search, setSearch] = useState<{
    query: string
    rows: PaletteStudentRow[]
    status: "done" | "error"
  } | null>(null)

  // Open from the keyboard shortcut or from the header control.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }
    function handleOpenRequest() {
      setOpen(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener(OPEN_STUDENT_SEARCH_EVENT, handleOpenRequest)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener(OPEN_STUDENT_SEARCH_EVENT, handleOpenRequest)
    }
  }, [])

  // Cmd/Ctrl+K should land the caret in the field, not on the dialog frame.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  const trimmedQuery = query.trim()
  const isQuerySearchable =
    trimmedQuery.length >= STUDENT_SEARCH_MIN_QUERY_LENGTH
  const currentSearch = search?.query === trimmedQuery ? search : null
  const searchStatus: SearchStatus = !isQuerySearchable
    ? "idle"
    : (currentSearch?.status ?? "loading")

  function resetSearch() {
    setQuery("")
    setSearch(null)
    setHighlighted(0)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetSearch()
    setOpen(nextOpen)
  }

  // Debounced search over the branch's active and inactive students.
  useEffect(() => {
    if (!open || !branchId || !isQuerySearchable) return
    let cancelled = false

    const timer = window.setTimeout(async () => {
      try {
        const [active, inactive] = await Promise.all([
          listStudents({
            status: STUDENT_STATUS.ACTIVE,
            branch_id: branchId,
            query: trimmedQuery,
            page_size: RESULTS_PER_STATUS,
          }),
          listStudents({
            status: STUDENT_STATUS.INACTIVE,
            branch_id: branchId,
            query: trimmedQuery,
            page_size: RESULTS_PER_STATUS,
          }),
        ])

        if (cancelled) return

        if (!active.success || !inactive.success) {
          setSearch({ query: trimmedQuery, rows: [], status: "error" })
          return
        }

        // The two queries are mutually exclusive in the database, but a student
        // that appears in both must never render twice (or collide on its key):
        // the active row wins because it is merged first.
        const seen = new Set<string>()
        const rows: PaletteStudentRow[] = []

        for (const [items, isActive] of [
          [active.data?.items ?? [], true],
          [inactive.data?.items ?? [], false],
        ] as const) {
          for (const student of items) {
            if (seen.has(student.id)) continue
            seen.add(student.id)
            rows.push({ student, isActive })
          }
        }

        setSearch({ query: trimmedQuery, rows, status: "done" })
        setHighlighted(0)
      } catch {
        if (cancelled) return
        setSearch({ query: trimmedQuery, rows: [], status: "error" })
      }
    }, STUDENT_SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, branchId, isQuerySearchable, trimmedQuery])

  const sections = filterSectionEntries(
    buildSectionEntries(navigationItems, branchId, {
      isAdmin,
      canManageProfile,
      isTeacherOnly,
    }),
    trimmedQuery
  )
  const students = isQuerySearchable
    ? buildStudentEntries(currentSearch?.rows ?? [], branchId)
    : []
  const entries: PaletteEntry[] = [...sections, ...students]

  function openEntry(entry: PaletteEntry) {
    resetSearch()
    setOpen(false)
    router.push(entry.href)
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((current) =>
        Math.min(current + 1, Math.max(entries.length - 1, 0))
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === "Enter") {
      const selected = entries[highlighted]
      if (selected === undefined) return
      event.preventDefault()
      openEntry(selected)
    }
  }

  const showMinQueryHint = !isQuerySearchable
  const showNoResults = entries.length === 0 && trimmedQuery.length > 0
  const activeOptionId =
    entries.length > 0 ? `${listId}-option-${highlighted}` : undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-24 max-w-lg translate-y-0 gap-3 p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{STUDENT_SEARCH_MESSAGES.DIALOG_TITLE}</DialogTitle>
          <DialogDescription>
            {STUDENT_SEARCH_MESSAGES.DIALOG_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-4">
          <label htmlFor={`${listId}-input`} className="sr-only">
            {STUDENT_SEARCH_MESSAGES.INPUT_LABEL}
          </label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`${listId}-input`}
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={STUDENT_SEARCH_MESSAGES.INPUT_PLACEHOLDER}
              autoComplete="off"
              role="combobox"
              aria-expanded={entries.length > 0}
              aria-controls={listId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              className="pl-8"
            />
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {searchStatus === "loading" ? STUDENT_SEARCH_MESSAGES.SEARCHING : ""}
          </p>

          <div className="min-h-24">
            {searchStatus === "error" && (
              <p role="alert" className="px-1 py-3 text-sm text-destructive">
                {STUDENT_SEARCH_MESSAGES.SEARCH_ERROR}
              </p>
            )}

            {showNoResults && (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                {STUDENT_SEARCH_MESSAGES.NO_RESULTS(trimmedQuery)}
              </p>
            )}

            {entries.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                aria-label={STUDENT_SEARCH_MESSAGES.RESULTS_LABEL}
                className="flex flex-col"
              >
                {entries.map((entry, index) => {
                  const Icon = entry.icon

                  return (
                    <li
                      key={`${entry.kind}-${entry.id}`}
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={index === highlighted}
                      aria-label={STUDENT_SEARCH_MESSAGES.OPEN_RESULT_LABEL(
                        entry.label
                      )}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2",
                        index === highlighted && "bg-muted"
                      )}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => openEntry(entry)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {entry.label}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {entry.meta}
                        </span>
                      </span>
                      {entry.kind === "student" && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {entry.badge}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {showMinQueryHint && (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                {STUDENT_SEARCH_MESSAGES.MIN_QUERY_HINT}
              </p>
            )}

            {searchStatus === "loading" && (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                {STUDENT_SEARCH_MESSAGES.SEARCHING}
              </p>
            )}
          </div>
        </div>

        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {STUDENT_SEARCH_MESSAGES.HINTS}
        </p>
      </DialogContent>
    </Dialog>
  )
}
