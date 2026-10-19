"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  NotebookPenIcon,
  PencilLineIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"

import {
  addPerClassStudentToSession,
  listPerClassCandidates,
  takeAttendance,
} from "@/lib/domain/attendance/actions"
import type {
  PerClassCandidateRow,
  SessionAttendanceEntry,
} from "@/lib/domain/attendance/actions"
import type { SessionGuestRow } from "@/lib/domain/guests/actions"
import { registerClassPayment } from "@/lib/domain/payments/actions"
import { AttendanceSeal } from "@/components/attendance/attendance-seal"
import { GuestsSection } from "@/components/attendance/guests-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ATTENDANCE_FORM_MESSAGES,
  ATTENDANCE_TOAST,
  COMMON_MESSAGES,
  PAYMENT_MESSAGES,
  STUDENT_MISSING_DATA_MESSAGES,
} from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

interface AttendanceSheetProps {
  scheduledClassId?: string
  oneTimeClassId?: string
  sessionDate: string
  branchId: string
  students: SessionAttendanceEntry[]
  guests: SessionGuestRow[]
  onSuccess?: () => void
}

interface AttendanceRecord {
  student_id: string
  attended: boolean
  observation: string
}

/** Post-save seal delay: lets the one-shot stamp animation play before the refresh closes the flow. */
const SEAL_STAMP_DELAY_MS = 650

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function sourceBadgeLabel(source: SessionAttendanceEntry["source"]): string {
  switch (source) {
    case "roster":
      return ATTENDANCE_FORM_MESSAGES.SOURCE_ROSTER
    case "per_class":
      return ATTENDANCE_FORM_MESSAGES.SOURCE_PER_CLASS
    case "history":
      return ATTENDANCE_FORM_MESSAGES.SOURCE_HISTORY
  }
}

function attendedStateLabel(attended: boolean | null): string {
  if (attended === true) return ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_PRESENT
  if (attended === false) return ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
  return ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_UNMARKED
}

function occurrencePayload(scheduledClassId?: string, oneTimeClassId?: string) {
  return scheduledClassId
    ? { scheduled_class_id: scheduledClassId }
    : { one_time_class_id: oneTimeClassId! }
}

/**
 * Belt "obi" strip: a small swatch always carrying a hairline border (so very
 * light belts like white stay visible on paper) and filled with the level
 * color whenever one exists. Rendering is deterministic on server and client
 * — no `CSS.supports` branching, which caused hydration mismatches and
 * uncolored swatches in server-rendered trees; browsers ignore invalid color
 * values, leaving the bordered hairline swatch. The level name travels via
 * `title` and visually-hidden text; no level means no text at all.
 */
function BeltChip({
  levelName,
  levelColor,
}: {
  levelName: string | null
  levelColor: string | null
}) {
  const hasColor = typeof levelColor === "string" && levelColor.length > 0
  return (
    <>
      <span
        title={levelName ?? undefined}
        aria-hidden={levelName ? undefined : true}
        className="h-5.5 w-2.5 shrink-0 rounded-full border border-border"
        style={hasColor ? { backgroundColor: levelColor } : undefined}
      />
      {levelName && <span className="sr-only">{levelName}</span>}
    </>
  )
}

export function AttendanceSheet({
  scheduledClassId,
  oneTimeClassId,
  sessionDate,
  branchId,
  students,
  guests,
  onSuccess,
}: AttendanceSheetProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<SessionAttendanceEntry[]>(students)
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    students.map((s) => ({
      student_id: s.student_id,
      attended: s.attended ?? true,
      observation: s.observation ?? "",
    }))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The session already had saved attendance on open (any editable entry
  // recorded): show the seal in the summary bar, statically.
  const [initiallyRecorded] = useState(() =>
    students.some((s) => s.source !== "history" && s.attended !== null)
  )
  const [stamped, setStamped] = useState(false)
  const [openNoteIds, setOpenNoteIds] = useState<Set<string>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // --- Per-class student picker ---
  const [showAddControl, setShowAddControl] = useState(false)
  const [search, setSearch] = useState("")
  const [candidates, setCandidates] = useState<PerClassCandidateRow[]>([])
  const [classPrice, setClassPrice] = useState<number | null>(null)
  const [selectedCandidate, setSelectedCandidate] =
    useState<PerClassCandidateRow | null>(null)
  const [registerPayment, setRegisterPayment] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [chargingStudentId, setChargingStudentId] = useState<string | null>(null)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!showAddControl) return
    const trimmed = search.trim()
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const result = await listPerClassCandidates({
          ...occurrencePayload(scheduledClassId, oneTimeClassId),
          session_date: scheduledClassId ? sessionDate : undefined,
          branch_id: branchId,
          ...(trimmed ? { search: trimmed } : {}),
        })
        if (seq !== searchSeq.current) return
        if (result.success && result.data) {
          setCandidates(result.data.students)
          setClassPrice(result.data.class_price)
        } else {
          setCandidates([])
        }
      } catch {
        if (seq === searchSeq.current) setCandidates([])
      } finally {
        if (seq === searchSeq.current) setIsSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [showAddControl, search, scheduledClassId, oneTimeClassId, sessionDate, branchId])

  function updateRecord(index: number, field: keyof AttendanceRecord, value: unknown) {
    setRecords((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function toggleNote(studentId: string) {
    setOpenNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  function markAllEditable(attended: boolean) {
    const editableIds = new Set(
      entries
        .filter((entry) => entry.source !== "history")
        .map((entry) => entry.student_id)
    )
    setRecords((prev) =>
      prev.map((record) =>
        editableIds.has(record.student_id) ? { ...record, attended } : record
      )
    )
  }

  function resetAddControl() {
    setShowAddControl(false)
    setSearch("")
    setCandidates([])
    setSelectedCandidate(null)
    setRegisterPayment(true)
  }

  async function handleAddPerClassStudent() {
    if (!selectedCandidate) return
    setIsAdding(true)
    setError(null)

    try {
      const result = await addPerClassStudentToSession({
        ...occurrencePayload(scheduledClassId, oneTimeClassId),
        session_date: scheduledClassId ? sessionDate : undefined,
        branch_id: branchId,
        student_id: selectedCandidate.student_id,
        register_payment: registerPayment,
      })

      if (!result.success || !result.data) {
        setError(result.error ?? ATTENDANCE_FORM_MESSAGES.ADD_FAILURE)
        return
      }

      const entry: SessionAttendanceEntry = {
        student_id: selectedCandidate.student_id,
        student_discipline_id: selectedCandidate.student_discipline_id,
        first_name: selectedCandidate.first_name,
        surname: selectedCandidate.surname,
        attended: true,
        observation: null,
        source: "per_class",
        billing_mode: "per_class",
        class_payment_registered: registerPayment,
        level_name: null,
        level_color: null,
      }
      setEntries((prev) => [
        ...prev,
        entry,
      ])
      setRecords((prev) => [
        ...prev,
        {
          student_id: selectedCandidate.student_id,
          attended: true,
          observation: "",
        },
      ])

      if (registerPayment) {
        toast.success(PAYMENT_MESSAGES.SUCCESS_CLASS)
      }
      resetAddControl()
      router.refresh()
    } catch {
      setError(ATTENDANCE_FORM_MESSAGES.ADD_FAILURE)
    } finally {
      setIsAdding(false)
    }
  }

  async function handleChargeClass(entry: SessionAttendanceEntry) {
    if (!entry.student_discipline_id) return
    setChargingStudentId(entry.student_id)
    setError(null)

    try {
      const result = await registerClassPayment({
        student_discipline_id: entry.student_discipline_id,
        branch_id: branchId,
        class_date: sessionDate,
        ...occurrencePayload(scheduledClassId, oneTimeClassId),
      })

      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      setEntries((prev) =>
        prev.map((row) =>
          row.student_id === entry.student_id
            ? { ...row, class_payment_registered: true }
            : row
        )
      )
      toast.success(PAYMENT_MESSAGES.SUCCESS_CLASS)
      router.refresh()
    } catch {
      setError(COMMON_MESSAGES.UNEXPECTED_ERROR)
    } finally {
      setChargingStudentId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const entryById = new Map(entries.map((entry) => [entry.student_id, entry]))
      const recordsToSave = records.filter((record) => {
        const entry = entryById.get(record.student_id)
        // History rows are kept visible but read-only: they are not part of
        // the session's editable attendance (takeAttendance rejects them).
        return entry && entry.source !== "history"
      })

      const result = await takeAttendance({
        ...(scheduledClassId
          ? { scheduled_class_id: scheduledClassId, session_date: sessionDate }
          : { one_time_class_id: oneTimeClassId }),
        branch_id: branchId,
        records: recordsToSave.map((r) => ({
          student_id: r.student_id,
          attended: r.attended,
          observation: r.observation || null,
        })),
      })

      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      toast.success(ATTENDANCE_TOAST.SAVED)
      // Stamp the seal, let the one-shot animation play (skipped under
      // reduced motion), then refresh and close.
      setStamped(true)
      const reducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      saveTimerRef.current = setTimeout(
        () => {
          saveTimerRef.current = null
          router.refresh()
          onSuccess?.()
        },
        reducedMotion ? 0 : SEAL_STAMP_DELAY_MS
      )
    } catch {
      setError(COMMON_MESSAGES.UNEXPECTED_ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const editableEntries = entries.filter((entry) => entry.source !== "history")
  const editableIds = new Set(editableEntries.map((entry) => entry.student_id))
  const presentCount = records.filter(
    (record) => editableIds.has(record.student_id) && record.attended
  ).length

  // The seal belongs to the stored record, not to the open session: it holds
  // only while the visible marks still equal the values the sheet was opened
  // with. Initial nulls map to the same defaults the records start from
  // (attended null -> true, observation null -> ""), so a fresh session reads
  // as clean — and it shows no seal at all until its first save.
  const initialById = new Map(students.map((s) => [s.student_id, s]))
  const isDirty = records.some((record) => {
    const initial = initialById.get(record.student_id)
    if (!initial || initial.source === "history") return false
    if (record.attended !== (initial.attended ?? true)) return true
    if (record.observation.trim() !== (initial.observation ?? "").trim())
      return true
    return false
  })

  const guestsSection = (
    <GuestsSection
      branchId={branchId}
      scheduledClassId={scheduledClassId}
      oneTimeClassId={oneTimeClassId}
      sessionDate={sessionDate}
      initialGuests={guests}
    />
  )

  const addPerClassControl = (
    <AddPerClassControl
      {...{
        showAddControl,
        setShowAddControl,
        search,
        setSearch,
        candidates,
        classPrice,
        selectedCandidate,
        setSelectedCandidate,
        registerPayment,
        setRegisterPayment,
        isSearching,
        isAdding,
        handleAddPerClassStudent,
        resetAddControl,
        error,
      }}
    />
  )

  if (entries.length === 0 && !showAddControl) {
    return (
      <div className="flex flex-col gap-6">
        <Empty className="rounded-lg border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {ATTENDANCE_FORM_MESSAGES.EMPTY_ELIGIBLE}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
        {addPerClassControl}
        {guestsSection}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-6">
      {editableEntries.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Count on one line, seal or unsaved marker at its end. */}
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="whitespace-nowrap text-base font-semibold tabular-nums">
              {ATTENDANCE_FORM_MESSAGES.PRESENT_COUNT(
                presentCount,
                editableEntries.length
              )}
            </p>
            {initiallyRecorded &&
              (isDirty ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-foreground">
                  <PencilLineIcon aria-hidden="true" className="size-3.5" />
                  {ATTENDANCE_FORM_MESSAGES.UNSAVED_CHANGES}
                </span>
              ) : (
                <AttendanceSeal size="md" />
              ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAllEditable(true)}
              disabled={isSubmitting}
            >
              {ATTENDANCE_FORM_MESSAGES.MARK_ALL_PRESENT}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAllEditable(false)}
              disabled={isSubmitting}
            >
              {ATTENDANCE_FORM_MESSAGES.MARK_ALL_ABSENT}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {entries.length > 0 && (
          <ul
            aria-label={ATTENDANCE_FORM_MESSAGES.LIST_LABEL}
            className="flex flex-col border-t border-border"
          >
            {entries.map((student) => {
              const recordIndex = records.findIndex(
                (r) => r.student_id === student.student_id
              )
              const isHistory = student.source === "history"
              const isAbsent =
                !isHistory &&
                recordIndex !== -1 &&
                !records[recordIndex].attended
              const canCharge =
                student.source === "per_class" &&
                !student.class_payment_registered &&
                Boolean(student.student_discipline_id)
              const record = recordIndex !== -1 ? records[recordIndex] : null

              if (isHistory || recordIndex === -1) {
                return (
                  <li
                    key={student.student_id}
                    data-disabled="true"
                    className="border-b border-border px-2 py-1.5"
                  >
                    <div className="flex min-h-8 items-center gap-3">
                      <BeltChip
                        levelName={student.level_name}
                        levelColor={student.level_color}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-muted-foreground">
                          {student.first_name} {student.surname}
                        </span>
                        {student.level_name && (
                          <span className="block text-xs text-muted-foreground">
                            {student.level_name}
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Meta row: read-only history state, outside any tap target. */}
                    <div className="flex flex-wrap items-center gap-2 ps-5.5">
                      <Badge variant="outline">
                        {sourceBadgeLabel(student.source)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {attendedStateLabel(student.attended)}
                      </span>
                    </div>
                  </li>
                )
              }

              return (
                <li
                  key={student.student_id}
                  className={cn(
                    "border-b border-border px-2 py-1.5",
                    isAbsent && "bg-muted/60"
                  )}
                >
                  {/*
                    Line 1 — tap target: the whole label toggles the checkbox.
                    The checkbox stays in this line in every state, so its
                    position never jumps between present/absent.
                  */}
                  <label
                    htmlFor={`attended-${student.student_id}`}
                    className="flex min-h-12 cursor-pointer items-center gap-3"
                  >
                    <BeltChip
                      levelName={student.level_name}
                      levelColor={student.level_color}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block line-clamp-2 text-sm text-foreground",
                          !isAbsent && "font-medium"
                        )}
                      >
                        {student.first_name} {student.surname}
                      </span>
                      {student.level_name && (
                        <span className="block text-xs text-muted-foreground">
                          {student.level_name}
                        </span>
                      )}
                    </span>
                    <Checkbox
                      id={`attended-${student.student_id}`}
                      checked={record!.attended}
                      onCheckedChange={(checked) =>
                        updateRecord(recordIndex, "attended", Boolean(checked))
                      }
                      disabled={isSubmitting}
                    />
                  </label>

                  {/*
                    Line 2 — meta row, outside the label so activating any of
                    it never toggles attendance. Holds the source badge, the
                    absent marker, the note preview, the note toggle and the
                    per-class charge action.
                  */}
                  <div className="flex flex-wrap items-center gap-2 ps-5.5">
                    {student.source !== "roster" && (
                      <Badge variant="secondary">
                        {sourceBadgeLabel(student.source)}
                      </Badge>
                    )}
                    {isAbsent && (
                      <span className="rounded-sm border border-foreground/30 px-1.5 text-xs font-medium text-foreground">
                        {ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT}
                      </span>
                    )}
                    {record &&
                      !openNoteIds.has(student.student_id) &&
                      record.observation && (
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                          {record.observation}
                        </p>
                      )}
                    {record && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="ml-auto"
                        onClick={() => toggleNote(student.student_id)}
                        disabled={isSubmitting}
                      >
                        <NotebookPenIcon aria-hidden="true" />
                        {record.observation
                          ? ATTENDANCE_FORM_MESSAGES.EDIT_NOTE
                          : ATTENDANCE_FORM_MESSAGES.ADD_NOTE}
                      </Button>
                    )}
                    {canCharge && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleChargeClass(student)}
                        disabled={
                          isSubmitting ||
                          chargingStudentId === student.student_id
                        }
                      >
                        {chargingStudentId === student.student_id
                          ? ATTENDANCE_FORM_MESSAGES.SAVING
                          : PAYMENT_MESSAGES.CHARGE_CLASS}
                      </Button>
                    )}
                  </div>

                  {record && openNoteIds.has(student.student_id) && (
                    <Input
                      aria-label={ATTENDANCE_FORM_MESSAGES.OBSERVATION_LABEL}
                      placeholder={
                        ATTENDANCE_FORM_MESSAGES.OBSERVATION_PLACEHOLDER
                      }
                      value={record.observation}
                      onChange={(e) =>
                        updateRecord(recordIndex, "observation", e.target.value)
                      }
                      maxLength={500}
                      disabled={isSubmitting}
                      className="mt-2 text-xs"
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {addPerClassControl}

        {editableEntries.length > 0 && (
          <div className="sticky bottom-0 -mx-4 border-t border-border bg-popover px-4 py-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full text-base"
            >
              {isSubmitting
                ? ATTENDANCE_FORM_MESSAGES.SAVING
                : ATTENDANCE_FORM_MESSAGES.SUBMIT}
            </Button>
          </div>
        )}
      </form>

      {stamped && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <AttendanceSeal stamped size="lg" />
        </div>
      )}

      {guestsSection}
    </div>
  )
}

interface AddPerClassControlProps {
  showAddControl: boolean
  setShowAddControl: (open: boolean) => void
  search: string
  setSearch: (value: string) => void
  candidates: PerClassCandidateRow[]
  classPrice: number | null
  selectedCandidate: PerClassCandidateRow | null
  setSelectedCandidate: (candidate: PerClassCandidateRow | null) => void
  registerPayment: boolean
  setRegisterPayment: (value: boolean) => void
  isSearching: boolean
  isAdding: boolean
  handleAddPerClassStudent: () => void
  resetAddControl: () => void
  error: string | null
}

function AddPerClassControl({
  showAddControl,
  setShowAddControl,
  search,
  setSearch,
  candidates,
  classPrice,
  selectedCandidate,
  setSelectedCandidate,
  registerPayment,
  setRegisterPayment,
  isSearching,
  isAdding,
  handleAddPerClassStudent,
  resetAddControl,
  error,
}: AddPerClassControlProps) {
  if (!showAddControl) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowAddControl(true)}
      >
        <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
        {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_TITLE}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-semibold">
        {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_TITLE}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="per-class-search">
          {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_SEARCH_LABEL}
        </Label>
        <Input
          id="per-class-search"
          type="search"
          placeholder={ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_SEARCH_PLACEHOLDER}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isAdding}
        />
      </div>

      <ul
        className="flex max-h-48 flex-col gap-1 overflow-y-auto"
        aria-label={ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_TITLE}
        aria-busy={isSearching}
      >
        {candidates.map((candidate) => {
          const isSelected = selectedCandidate?.student_id === candidate.student_id
          return (
            <li key={candidate.student_id}>
              <label
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                htmlFor={`candidate-${candidate.student_id}`}
              >
                <input
                  id={`candidate-${candidate.student_id}`}
                  type="radio"
                  name="per-class-candidate"
                  className="accent-primary"
                  checked={isSelected}
                  onChange={() => setSelectedCandidate(candidate)}
                  disabled={isAdding}
                />
                {candidate.first_name} {candidate.surname}
                <span className="text-xs text-muted-foreground">
                  {candidate.national_id ?? STUDENT_MISSING_DATA_MESSAGES.NOT_PROVIDED}
                </span>
              </label>
            </li>
          )
        })}
        {!isSearching && candidates.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">
            {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_NO_RESULTS}
          </li>
        )}
      </ul>

      {selectedCandidate && (
        <div className="flex flex-col gap-2">
          {classPrice != null ? (
            <label
              htmlFor="register-class-payment"
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                id="register-class-payment"
                checked={registerPayment}
                onCheckedChange={(checked) =>
                  setRegisterPayment(Boolean(checked))
                }
                disabled={isAdding}
              />
              {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_REGISTER_PAYMENT(
                formatAmount(classPrice)
              )}
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              {ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_PRICE_UNSET}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddPerClassStudent}
              disabled={isAdding || (classPrice == null && registerPayment)}
            >
              {isAdding
                ? ATTENDANCE_FORM_MESSAGES.ADDING
                : ATTENDANCE_FORM_MESSAGES.ADD_PER_CLASS_CONFIRM}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetAddControl}
              disabled={isAdding}
            >
              {COMMON_MESSAGES.CANCEL}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
