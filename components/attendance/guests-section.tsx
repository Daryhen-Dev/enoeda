"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2Icon, UserPlusIcon } from "lucide-react"

import {
  addGuestToSession,
  getGuestForConversion,
  linkGuestToStudent,
  removeGuestFromSession,
  type GuestConversionData,
  type SessionGuestRow,
} from "@/lib/domain/guests/actions"
import { StudentFormDialog } from "@/components/students/student-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  COMMON_MESSAGES,
  GUEST_FORM_MESSAGES,
  GUEST_MESSAGES,
} from "@/lib/localization/es-ec"

interface GuestsSectionProps {
  branchId: string
  scheduledClassId?: string
  oneTimeClassId?: string
  sessionDate: string
  initialGuests: SessionGuestRow[]
}

interface ConversionTarget {
  guestId: string
  data: GuestConversionData
}

/**
 * Trial-class guests of the session (T7): add inline, remove when allowed,
 * and convert into a student via the normal student creation form prefilled
 * with the guest data. Rendered OUTSIDE the attendance form so its inputs
 * never submit attendance.
 */
export function GuestsSection({
  branchId,
  scheduledClassId,
  oneTimeClassId,
  sessionDate,
  initialGuests,
}: GuestsSectionProps) {
  const router = useRouter()
  const [guests, setGuests] = useState<SessionGuestRow[]>(initialGuests)
  const [error, setError] = useState<string | null>(null)

  // --- Inline add form ---
  const [showAddForm, setShowAddForm] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [surname, setSurname] = useState("")
  const [phone, setPhone] = useState("")
  const [observation, setObservation] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const firstNameId = useId()
  const surnameId = useId()
  const phoneId = useId()
  const observationId = useId()

  // --- Remove ---
  const [removingGuestId, setRemovingGuestId] = useState<string | null>(null)

  // --- Convert to student ---
  const [convertingGuestId, setConvertingGuestId] = useState<string | null>(null)
  const [conversion, setConversion] = useState<ConversionTarget | null>(null)
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false)

  function resetAddForm() {
    setShowAddForm(false)
    setFirstName("")
    setSurname("")
    setPhone("")
    setObservation("")
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault()
    setIsAdding(true)
    setError(null)

    try {
      const result = await addGuestToSession({
        ...(scheduledClassId
          ? { scheduled_class_id: scheduledClassId, session_date: sessionDate }
          : { one_time_class_id: oneTimeClassId }),
        branch_id: branchId,
        first_name: firstName,
        surname: surname,
        ...(phone.trim() ? { phone: phone } : {}),
        ...(observation.trim() ? { observation } : {}),
      })

      if (!result.success || !result.data) {
        setError(result.error ?? GUEST_MESSAGES.ADD_FAILURE)
        return
      }

      setGuests((prev) => [
        ...prev,
        {
          guest_id: result.data!.guest_id,
          first_name: firstName.trim(),
          surname: surname.trim(),
          phone: phone.trim() || null,
          observation: observation.trim() || null,
          converted_student_id: null,
          created_by: null,
        },
      ])
      resetAddForm()
      toast.success(GUEST_MESSAGES.ADD_SUCCESS)
      router.refresh()
    } catch {
      setError(GUEST_MESSAGES.ADD_FAILURE)
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemoveGuest(guest: SessionGuestRow) {
    setRemovingGuestId(guest.guest_id)
    setError(null)

    try {
      const result = await removeGuestFromSession({
        branch_id: branchId,
        guest_id: guest.guest_id,
      })

      if (!result.success) {
        setError(result.error ?? GUEST_MESSAGES.REMOVE_FAILURE)
        return
      }

      setGuests((prev) => prev.filter((row) => row.guest_id !== guest.guest_id))
      toast.success(GUEST_MESSAGES.REMOVE_SUCCESS)
    } catch {
      setError(GUEST_MESSAGES.REMOVE_FAILURE)
    } finally {
      setRemovingGuestId(null)
    }
  }

  async function handleConvertClick(guest: SessionGuestRow) {
    setConvertingGuestId(guest.guest_id)
    setError(null)

    try {
      const result = await getGuestForConversion({
        branch_id: branchId,
        guest_id: guest.guest_id,
      })

      if (!result.success || !result.data) {
        setError(result.error ?? GUEST_MESSAGES.LOAD_CONVERSION_FAILURE)
        return
      }

      setConversion({ guestId: guest.guest_id, data: result.data })
      setIsConvertDialogOpen(true)
    } catch {
      setError(GUEST_MESSAGES.LOAD_CONVERSION_FAILURE)
    } finally {
      setConvertingGuestId(null)
    }
  }

  async function handleGuestConverted(guestId: string, studentId: string) {
    const result = await linkGuestToStudent({
      branch_id: branchId,
      guest_id: guestId,
      student_id: studentId,
    })

    if (!result.success) {
      toast.error(result.error ?? GUEST_MESSAGES.LINK_FAILURE)
      return
    }

    setGuests((prev) =>
      prev.map((row) =>
        row.guest_id === guestId
          ? { ...row, converted_student_id: studentId }
          : row
      )
    )
    toast.success(GUEST_MESSAGES.LINK_SUCCESS)
    router.refresh()
  }

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={GUEST_FORM_MESSAGES.SECTION_TITLE}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {GUEST_FORM_MESSAGES.SECTION_TITLE}
          </h3>
          <p className="text-xs text-muted-foreground">
            {GUEST_FORM_MESSAGES.SECTION_DESCRIPTION}
          </p>
        </div>
        {!showAddForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
            {GUEST_FORM_MESSAGES.ADD_BUTTON}
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {showAddForm && (
        <form
          className="flex flex-col gap-3 rounded-md border p-3"
          onSubmit={handleAddGuest}
          aria-label={GUEST_FORM_MESSAGES.ADD_BUTTON}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={firstNameId}>
                {GUEST_FORM_MESSAGES.FIRST_NAME_LABEL}
              </Label>
              <Input
                id={firstNameId}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                required
                disabled={isAdding}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={surnameId}>
                {GUEST_FORM_MESSAGES.SURNAME_LABEL}
              </Label>
              <Input
                id={surnameId}
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                maxLength={100}
                required
                disabled={isAdding}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={phoneId}>{GUEST_FORM_MESSAGES.PHONE_LABEL}</Label>
              <Input
                id={phoneId}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                disabled={isAdding}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={observationId}>
                {GUEST_FORM_MESSAGES.OBSERVATION_LABEL}
              </Label>
              <Input
                id={observationId}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                maxLength={500}
                disabled={isAdding}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding
                ? GUEST_FORM_MESSAGES.ADDING
                : GUEST_FORM_MESSAGES.ADD_ACTION}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetAddForm}
              disabled={isAdding}
            >
              {COMMON_MESSAGES.CANCEL}
            </Button>
          </div>
        </form>
      )}

      <ul
        className="flex flex-col gap-2"
        aria-label={GUEST_FORM_MESSAGES.ARIA_GUEST_LIST}
      >
        {guests.map((guest) => (
          <li
            key={guest.guest_id}
            className="flex flex-col gap-1.5 rounded-md border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">
                {guest.first_name} {guest.surname}
              </span>
              {guest.converted_student_id ? (
                <Badge variant="secondary">
                  {GUEST_FORM_MESSAGES.CONVERTED_BADGE}
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleConvertClick(guest)}
                  disabled={convertingGuestId === guest.guest_id}
                >
                  {GUEST_FORM_MESSAGES.CONVERT_ACTION}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleRemoveGuest(guest)}
                disabled={removingGuestId === guest.guest_id}
                aria-label={`${GUEST_FORM_MESSAGES.REMOVE_ACTION}: ${guest.first_name} ${guest.surname}`}
              >
                <Trash2Icon aria-hidden="true" />
                {GUEST_FORM_MESSAGES.REMOVE_ACTION}
              </Button>
            </div>
            {guest.phone && (
              <p className="text-xs text-muted-foreground">
                {GUEST_FORM_MESSAGES.PHONE_PREFIX}: {guest.phone}
              </p>
            )}
            {guest.observation && (
              <p className="text-xs text-muted-foreground">
                {GUEST_FORM_MESSAGES.OBSERVATION_PREFIX}: {guest.observation}
              </p>
            )}
          </li>
        ))}
        {guests.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">
            {GUEST_FORM_MESSAGES.EMPTY}
          </li>
        )}
      </ul>

      {conversion && (
        <StudentFormDialog
          open={isConvertDialogOpen}
          onOpenChange={(open) => {
            setIsConvertDialogOpen(open)
            if (!open) {
              setConversion(null)
            }
          }}
          prefill={{
            first_name: conversion.data.first_name,
            surname: conversion.data.surname,
            phone: conversion.data.phone ?? "",
            discipline_id: conversion.data.discipline_id,
          }}
          disciplines={[
            {
              id: conversion.data.discipline_id,
              name: conversion.data.discipline_name,
            },
          ]}
          branches={[{ id: branchId, name: conversion.data.branch_name }]}
          lockedBranchId={branchId}
          onCreated={(studentId) => {
            void handleGuestConverted(conversion.guestId, studentId)
          }}
        />
      )}
    </section>
  )
}
