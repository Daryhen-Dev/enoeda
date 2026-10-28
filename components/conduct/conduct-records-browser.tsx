"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { onConductRecordCreated } from "@/components/conduct/conduct-events"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  RecentConductRecords,
  type RecentConductRecordView,
} from "@/components/conduct/recent-conduct-records"
import {
  listBranchConductRecords,
  searchConductStudents,
  type ConductStudentSearchRow,
} from "@/lib/domain/conduct"
import {
  CONDUCT_QUICK_ENTRY_MESSAGES,
  CONDUCT_RECORDS_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

/** Same debounce window as the roster candidate search. */
const SEARCH_DEBOUNCE_MS = 300

type SearchStatus = "idle" | "loading" | "done" | "error"
type RecordsStatus = "idle" | "loading" | "done" | "error"

interface ConductRecordsBrowserProps {
  branchId: string
  /** Branch records rendered before any filter (newest first). */
  initialRecords: RecentConductRecordView[]
  /** Set when the initial branch records failed to load. */
  initialError?: string
}

function studentFullName(student: { first_name: string; surname: string }) {
  return `${student.surname} ${student.first_name}`
}

/**
 * Records list of the Conducta page with its single "Alumno" filter: the list
 * leads, the debounced search narrows it to one student, and clearing the
 * filter returns to the branch's latest records. Rows stay read-only; the
 * per-record actions live on the student detail page.
 */
export function ConductRecordsBrowser({
  branchId,
  initialRecords,
  initialError,
}: ConductRecordsBrowserProps) {
  const [searchInput, setSearchInput] = useState("")
  const [results, setResults] = useState<ConductStudentSearchRow[]>([])
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedStudent, setSelectedStudent] =
    useState<ConductStudentSearchRow | null>(null)
  const [studentRecords, setStudentRecords] = useState<
    RecentConductRecordView[]
  >([])
  const [recordsStatus, setRecordsStatus] = useState<RecordsStatus>("idle")
  const [recordsError, setRecordsError] = useState<string | null>(null)
  // Sequence guards: only the latest response may update state.
  const searchSeqRef = useRef(0)
  const recordsSeqRef = useRef(0)
  const listboxId = useId()

  // Debounced student search, same seq-guard pattern as the quick entry;
  // setState only ever runs inside timer/async callbacks.
  useEffect(() => {
    const trimmed = searchInput.trim()

    async function loadResults(query: string) {
      const seq = ++searchSeqRef.current
      setSearchStatus("loading")
      try {
        const result = await searchConductStudents({
          branch_id: branchId,
          query,
        })
        if (seq !== searchSeqRef.current) return
        if (result.success && result.data) {
          setResults(result.data.students)
          setSearchStatus("done")
        } else {
          setResults([])
          setSearchStatus("error")
        }
      } catch {
        if (seq === searchSeqRef.current) {
          setResults([])
          setSearchStatus("error")
        }
      }
      if (seq === searchSeqRef.current) setHighlightedIndex(-1)
    }

    const timer = setTimeout(
      () => {
        if (!trimmed) {
          setResults([])
          setSearchStatus("idle")
          setHighlightedIndex(-1)
          return
        }
        void loadResults(trimmed)
      },
      trimmed ? SEARCH_DEBOUNCE_MS : 0
    )
    return () => clearTimeout(timer)
  }, [searchInput, branchId])

  function clearSearch() {
    setSearchInput("")
    setResults([])
    setSearchStatus("idle")
    setHighlightedIndex(-1)
  }

  const loadStudentRecords = useCallback(
    async (studentId: string) => {    const seq = ++recordsSeqRef.current
    setRecordsStatus("loading")
    setRecordsError(null)
    try {
      const result = await listBranchConductRecords({
        branch_id: branchId,
        student_id: studentId,
      })
      if (seq !== recordsSeqRef.current) return
      if (result.success && result.data) {
        setStudentRecords(result.data.records)
        setRecordsStatus("done")
      } else {
        setStudentRecords([])
        setRecordsStatus("error")
        setRecordsError(CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_LOAD_FAILURE)
      }
    } catch {
      if (seq !== recordsSeqRef.current) return
      setStudentRecords([])
      setRecordsStatus("error")
      setRecordsError(CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_LOAD_FAILURE)
    }
    },
    [branchId]
  )

  // A record created from the "Registrar" sheet refreshes the branch list on
  // the server; the student currently filtered must re-read their own rows.
  useEffect(() => {
    if (!selectedStudent) return
    return onConductRecordCreated(() => {
      void loadStudentRecords(selectedStudent.id)
    })
  }, [selectedStudent, loadStudentRecords])

  function pickStudent(student: ConductStudentSearchRow) {
    setSelectedStudent(student)
    clearSearch()
    void loadStudentRecords(student.id)
  }

  function clearFilter() {
    recordsSeqRef.current += 1
    setSelectedStudent(null)
    setStudentRecords([])
    setRecordsStatus("idle")
    setRecordsError(null)
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      clearSearch()
      return
    }
    if (!resultsOpen) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        event.preventDefault()
        pickStudent(results[highlightedIndex])
      }
    }
  }

  const query = searchInput.trim()
  const resultsOpen = !selectedStudent && results.length > 0
  const isFiltered = selectedStudent !== null

  return (
    <div className="flex w-full flex-col gap-3">
      {selectedStudent ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
          <p className="min-w-0 truncate text-sm">
            {CONDUCT_RECORDS_MESSAGES.FILTER_ACTIVE(
              studentFullName(selectedStudent)
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilter}>
            {CONDUCT_RECORDS_MESSAGES.FILTER_CLEAR}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Field>
            <FieldLabel htmlFor="conduct-record-filter">
              {CONDUCT_RECORDS_MESSAGES.FILTER_LABEL}
            </FieldLabel>
            <Input
              id="conduct-record-filter"
              type="search"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={resultsOpen}
              aria-controls={resultsOpen ? listboxId : undefined}
              aria-activedescendant={
                resultsOpen && highlightedIndex >= 0
                  ? `${listboxId}-option-${highlightedIndex}`
                  : undefined
              }
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_PLACEHOLDER}
              maxLength={100}
            />
          </Field>

          {/* Search status for screen readers and as a non-color cue. */}
          <div role="status" aria-live="polite">
            {searchStatus === "error" ? (
              <p role="alert" className="text-sm text-destructive">
                {CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_ERROR}
              </p>
            ) : searchStatus === "loading" ? (
              <p className="text-sm text-muted-foreground">
                {CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_LOADING}
              </p>
            ) : searchStatus === "done" && results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_NO_RESULTS(query)}
              </p>
            ) : null}
          </div>

          {resultsOpen && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_RESULTS_ARIA_LABEL}
              className="flex flex-col overflow-hidden rounded-md border"
            >
              {results.map((student, index) => (
                <li
                  key={student.id}
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={index === highlightedIndex}
                  className={cn(
                    "border-b last:border-b-0",
                    index === highlightedIndex && "bg-muted/60"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/40"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickStudent(student)}
                  >
                    <span className="truncate text-sm font-medium">
                      {studentFullName(student)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {student.national_id ??
                        STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <RecentConductRecords
        records={isFiltered ? studentRecords : initialRecords}
        branchId={branchId}
        initialError={
          isFiltered ? (recordsError ?? undefined) : initialError
        }
        title={
          selectedStudent
            ? CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_TITLE(
                studentFullName(selectedStudent)
              )
            : undefined
        }
        emptyTitle={
          isFiltered
            ? CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_EMPTY
            : undefined
        }
        loading={isFiltered && recordsStatus === "loading"}
      />
    </div>
  )
}
