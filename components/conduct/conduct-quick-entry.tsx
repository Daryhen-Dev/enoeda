"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CONDUCT_KINDS,
  MAX_FINE_AMOUNT,
  searchConductStudents,
  type ConductStudentSearchRow,
} from "@/lib/domain/conduct"
import {
  buildConductFormSchema,
  submitConductForm,
  type ConductFormValues,
} from "@/components/conduct/conduct-form"
import {
  COMMON_MESSAGES,
  CONDUCT_MESSAGES,
  CONDUCT_QUICK_ENTRY_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
  TOAST_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

/** Same debounce window as the roster candidate search. */
const SEARCH_DEBOUNCE_MS = 300

type SearchStatus = "idle" | "loading" | "done" | "error"

interface ConductQuickEntryProps {
  branchId: string
  /** Branch-timezone today (YYYY-MM-DD); default and max for the incident date. */
  todayDateOnly: string
  /** Called after a record is registered (e.g. to close a hosting sheet). */
  onSuccess?: () => void
}

/**
 * "2 multas pendientes · 1 llamado" style counters built from the existing
 * CONDUCT_MESSAGES summary helpers.
 */
export function summarizeConductCounters(row: Pick<
  ConductStudentSearchRow,
  "pending_fines_count" | "pending_fines_total" | "warnings_count"
>): string {
  const items: string[] = []
  if (row.pending_fines_count > 0) {
    items.push(
      CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(
        row.pending_fines_count,
        formatCurrency(row.pending_fines_total)
      )
    )
  }
  if (row.warnings_count > 0) {
    items.push(CONDUCT_MESSAGES.SUMMARY_WARNINGS(row.warnings_count))
  }
  return items.join(" · ")
}

function fullName(student: { first_name: string; surname: string }): string {
  return `${student.surname} ${student.first_name}`
}

/**
 * Quick-entry flow: search a student, register a fine or a warning inline,
 * then the form resets and refocuses the search so the next student can be
 * entered immediately. Server actions re-assert authorization.
 */
export function ConductQuickEntry({
  branchId,
  todayDateOnly,
  onSuccess,
}: ConductQuickEntryProps) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState("")
  const [results, setResults] = useState<ConductStudentSearchRow[]>([])
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle")
  const [selectedStudent, setSelectedStudent] =
    useState<ConductStudentSearchRow | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Sequence guard: only the latest search response may update state.
  const searchSeqRef = useRef(0)
  const listboxId = useId()
  const reasonId = useId()
  const incidentDateId = useId()
  const amountId = useId()

  const form = useForm<ConductFormValues>({
    resolver: zodResolver(buildConductFormSchema(todayDateOnly)),
    defaultValues: {
      kind: CONDUCT_KINDS.FINE,
      reason: "",
      incident_date: todayDateOnly,
      amount: "",
    },
    mode: "onSubmit",
  })
  const isPending = form.formState.isSubmitting
  const resultsOpen = !selectedStudent && results.length > 0

  // Debounced student search (SEARCH_DEBOUNCE_MS) with the same seq-guard
  // pattern as the roster candidate search; setState only ever runs inside
  // timer/async callbacks, never synchronously in the effect body.
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

  function pickStudent(student: ConductStudentSearchRow) {
    // Keep the chosen kind between entries; clear everything else so each
    // student starts from a fresh form.
    form.reset({
      kind: form.getValues("kind") || CONDUCT_KINDS.FINE,
      reason: "",
      incident_date: todayDateOnly,
      amount: "",
    })
    setSubmitError(null)
    setSelectedStudent(student)
    clearSearch()
  }

  function focusSearchInput() {
    document.getElementById("conduct-student-search")?.focus()
  }

  function handleChangeStudent() {
    setSelectedStudent(null)
    setSubmitError(null)
    // Ready for a fresh search without leaving the page.
    requestAnimationFrame(focusSearchInput)
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

  async function handleSubmit(values: ConductFormValues) {
    if (!selectedStudent) return
    setSubmitError(null)
    const result = await submitConductForm(
      values,
      selectedStudent.id,
      branchId
    )

    if (result.success) {
      const kind = values.kind
      form.reset({
        kind,
        reason: "",
        incident_date: todayDateOnly,
        amount: "",
      })
      setSelectedStudent(null)
      setSubmitError(null)
      toast.success(TOAST_MESSAGES.CONDUCT_CREATED)
      router.refresh()
      // Immediately ready for the next student.
      focusSearchInput()
      onSuccess?.()
    } else {
      setSubmitError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
    }
  }

  const query = searchInput.trim()

  return (
    <section className="flex flex-col gap-3">
      {!selectedStudent ? (
        <div className="flex flex-col gap-1">
          <Field>
            <FieldLabel htmlFor="conduct-student-search">
              {CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_LABEL}
            </FieldLabel>
            <Input
              id="conduct-student-search"
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
              autoFocus
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
              aria-label={
                CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_RESULTS_ARIA_LABEL
              }
              className="flex flex-col overflow-hidden rounded-md border"
            >
              {results.map((student, index) => {
                const counters = summarizeConductCounters(student)
                return (
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
                        {fullName(student)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {student.national_id ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
                      </span>
                      {counters && (
                        <span className="text-xs text-muted-foreground">
                          {counters}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col gap-4 rounded-md border p-3"
          aria-label={CONDUCT_QUICK_ENTRY_MESSAGES.SELECTED_SECTION_ARIA_LABEL}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {fullName(selectedStudent)}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedStudent.national_id ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
              </span>
              {summarizeConductCounters(selectedStudent) && (
                <span className="text-xs text-muted-foreground">
                  {summarizeConductCounters(selectedStudent)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/dashboard/students/${selectedStudent.id}?branch=${branchId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {CONDUCT_QUICK_ENTRY_MESSAGES.VIEW_PROFILE}
              </Link>
              <Button variant="ghost" size="sm" onClick={handleChangeStudent}>
                {CONDUCT_QUICK_ENTRY_MESSAGES.CHANGE_STUDENT}
              </Button>
            </div>
          </div>

          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <>
                    <Field>
                      <FieldLabel>
                        {CONDUCT_MESSAGES.KIND_FIELD_LABEL}
                      </FieldLabel>
                      <ToggleGroup
                        value={[field.value]}
                        onValueChange={(value) => {
                          const next = value[0] as string | undefined
                          if (next) {
                            field.onChange(next)
                            form.clearErrors("amount")
                          }
                        }}
                        variant="outline"
                        aria-label={CONDUCT_MESSAGES.KIND_FIELD_LABEL}
                        className="w-full"
                      >
                        <ToggleGroupItem
                          value={CONDUCT_KINDS.FINE}
                          className="flex-1"
                        >
                          {CONDUCT_MESSAGES.KIND_FINE}
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value={CONDUCT_KINDS.WARNING}
                          className="flex-1"
                        >
                          {CONDUCT_MESSAGES.KIND_WARNING}
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </Field>

                    {/* Amount applies to fines only. */}
                    {field.value === CONDUCT_KINDS.FINE && (
                      <Field
                        data-invalid={Boolean(form.formState.errors.amount)}
                      >
                        <FieldLabel htmlFor={amountId}>
                          {CONDUCT_MESSAGES.AMOUNT_FIELD_LABEL}
                        </FieldLabel>
                        <Input
                          id={amountId}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          max={MAX_FINE_AMOUNT}
                          {...form.register("amount")}
                          placeholder="0.00"
                          aria-invalid={Boolean(form.formState.errors.amount)}
                          disabled={isPending}
                        />
                        {form.formState.errors.amount && (
                          <FieldError>
                            {form.formState.errors.amount.message}
                          </FieldError>
                        )}
                      </Field>
                    )}
                  </>
                )}
              />

              <Field data-invalid={Boolean(form.formState.errors.reason)}>
                <FieldLabel htmlFor={reasonId}>
                  {CONDUCT_MESSAGES.REASON_FIELD_LABEL}
                </FieldLabel>
                <textarea
                  id={reasonId}
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
                  {...form.register("reason")}
                  autoFocus
                  placeholder={CONDUCT_MESSAGES.REASON_PLACEHOLDER}
                  maxLength={2000}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  disabled={isPending}
                />
                {form.formState.errors.reason && (
                  <FieldError>{form.formState.errors.reason.message}</FieldError>
                )}
              </Field>

              <Field
                data-invalid={Boolean(form.formState.errors.incident_date)}
              >
                <FieldLabel htmlFor={incidentDateId}>
                  {CONDUCT_MESSAGES.INCIDENT_DATE_FIELD_LABEL}
                </FieldLabel>
                <Input
                  id={incidentDateId}
                  type="date"
                  max={todayDateOnly}
                  {...form.register("incident_date")}
                  aria-invalid={Boolean(form.formState.errors.incident_date)}
                  disabled={isPending}
                />
                {form.formState.errors.incident_date && (
                  <FieldError>
                    {form.formState.errors.incident_date.message}
                  </FieldError>
                )}
              </Field>

              {submitError && <FieldError>{submitError}</FieldError>}
            </FieldGroup>

            <Button type="submit" disabled={isPending} className="self-start">
              {isPending
                ? CONDUCT_QUICK_ENTRY_MESSAGES.SUBMITTING
                : CONDUCT_QUICK_ENTRY_MESSAGES.SUBMIT}
            </Button>
          </form>
        </div>
      )}
    </section>
  )
}
