"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlusIcon } from "lucide-react"

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
import { GuestsSection } from "@/components/attendance/guests-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ATTENDANCE_FORM_MESSAGES,
  ATTENDANCE_TOAST,
  COMMON_MESSAGES,
  PAYMENT_MESSAGES,
} from "@/lib/localization/es-ec"

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
      router.refresh()
      onSuccess?.()
    } catch {
      setError(COMMON_MESSAGES.UNEXPECTED_ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const editableEntries = entries.filter((entry) => entry.source !== "history")

  const guestsSection = (
    <GuestsSection
      branchId={branchId}
      scheduledClassId={scheduledClassId}
      oneTimeClassId={oneTimeClassId}
      sessionDate={sessionDate}
      initialGuests={guests}
    />
  )

  if (entries.length === 0 && !showAddControl) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <p className="py-4 text-center text-sm text-muted-foreground">
            {ATTENDANCE_FORM_MESSAGES.EMPTY_ELIGIBLE}
          </p>
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
        </div>
        {guestsSection}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((student) => {
          const recordIndex = records.findIndex(
            (r) => r.student_id === student.student_id
          )
          const isHistory = student.source === "history"
          const canCharge =
            student.source === "per_class" &&
            !student.class_payment_registered &&
            Boolean(student.student_discipline_id)

          return (
            <div
              key={student.student_id}
              className="flex flex-col gap-1.5 rounded-md border p-3"
              aria-disabled={isHistory}
            >
              <div className="flex items-center gap-3">
                {isHistory || recordIndex === -1 ? (
                  <span className="flex-1 text-sm font-medium text-muted-foreground">
                    {student.first_name} {student.surname}
                  </span>
                ) : (
                  <label
                    htmlFor={`attended-${student.student_id}`}
                    className="flex flex-1 items-center gap-2 text-sm font-medium"
                  >
                    <Checkbox
                      id={`attended-${student.student_id}`}
                      checked={records[recordIndex].attended}
                      onCheckedChange={(checked) =>
                        updateRecord(recordIndex, "attended", Boolean(checked))
                      }
                      disabled={isSubmitting}
                    />
                    {student.first_name} {student.surname}
                  </label>
                )}
                <Badge
                  variant={
                    student.source === "history" ? "outline" : "secondary"
                  }
                >
                  {sourceBadgeLabel(student.source)}
                </Badge>
              </div>
              {isHistory ? (
                <p className="text-xs text-muted-foreground">
                  {attendedStateLabel(student.attended)}
                </p>
              ) : (
                recordIndex !== -1 && (
                  <Input
                    aria-label={ATTENDANCE_FORM_MESSAGES.OBSERVATION_LABEL}
                    placeholder={ATTENDANCE_FORM_MESSAGES.OBSERVATION_PLACEHOLDER}
                    value={records[recordIndex].observation}
                    onChange={(e) =>
                      updateRecord(recordIndex, "observation", e.target.value)
                    }
                    maxLength={500}
                    disabled={isSubmitting}
                    className="text-xs"
                  />
                )
              )}
              {canCharge && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleChargeClass(student)}
                    disabled={isSubmitting || chargingStudentId === student.student_id}
                  >
                    {chargingStudentId === student.student_id
                      ? ATTENDANCE_FORM_MESSAGES.SAVING
                      : PAYMENT_MESSAGES.CHARGE_CLASS}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

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
          error: null,
        }}
      />

      {editableEntries.length > 0 && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? ATTENDANCE_FORM_MESSAGES.SAVING : ATTENDANCE_FORM_MESSAGES.SUBMIT}
        </Button>
      )}
      </form>

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
      <p className="text-sm font-medium">
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
                  {candidate.national_id}
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
