"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ensureOwnProfile, updateOwnProfile, type OwnProfile } from "@/lib/domain/profile"
import {
  COMMON_MESSAGES,
  PROFILE_MESSAGES,
  ROLE_CREATION_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec"

interface ProfileFormProps {
  profile: OwnProfile | null
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(profile?.first_name ?? "")
  const [surname, setSurname] = useState(profile?.surname ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isSetup = profile === null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const input = {
        first_name: firstName,
        surname,
        phone: phone || undefined,
        date_of_birth: dateOfBirth,
      }
      const result = isSetup
        ? await ensureOwnProfile(input)
        : await updateOwnProfile(input)

      if (!result.success) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }

      setError(null)
      toast.success(
        isSetup ? TOAST_MESSAGES.PROFILE_CREATED : TOAST_MESSAGES.PROFILE_UPDATED
      )
      router.refresh()
    })
  }

  return (
    <form className="max-w-xl space-y-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="profile-first-name">
            {ROLE_CREATION_MESSAGES.FIRST_NAME_LABEL}
          </FieldLabel>
          <Input id="profile-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-surname">
            {ROLE_CREATION_MESSAGES.SURNAME_LABEL}
          </FieldLabel>
          <Input id="profile-surname" value={surname} onChange={(event) => setSurname(event.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-phone">
            {ROLE_CREATION_MESSAGES.PHONE_LABEL}
          </FieldLabel>
          <Input id="profile-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-date-of-birth">
            {ROLE_CREATION_MESSAGES.DATE_OF_BIRTH_LABEL}
          </FieldLabel>
          <Input id="profile-date-of-birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} required />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>
      <Button disabled={isPending} type="submit">
        {isPending
          ? PROFILE_MESSAGES.SAVING
          : isSetup
            ? PROFILE_MESSAGES.COMPLETE_SETUP
            : COMMON_MESSAGES.SAVE}
      </Button>
    </form>
  )
}
