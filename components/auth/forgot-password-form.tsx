"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requestPasswordRecovery } from "@/lib/auth/password-recovery"
import { FORGOT_PASSWORD_MESSAGES } from "@/lib/localization/es-ec"

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email")

    const result = await requestPasswordRecovery({ email })

    if (!result.success) {
      setErrorMessage(result.error ?? FORGOT_PASSWORD_MESSAGES.FAILURE)
      setIsPending(false)
      return
    }

    // Enumeration-neutral: the same confirmation shows whether or not the
    // email exists.
    setSent(true)
    setIsPending(false)
  }

  if (sent) {
    return (
      <p aria-live="polite" className="mt-6 text-sm text-muted-foreground">
        {FORGOT_PASSWORD_MESSAGES.EMAIL_SENT}
      </p>
    )
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          {FORGOT_PASSWORD_MESSAGES.EMAIL_LABEL}
        </label>
        <Input
          autoComplete="email"
          disabled={isPending}
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      {errorMessage ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button aria-busy={isPending} className="w-full" disabled={isPending} type="submit">
        {isPending ? FORGOT_PASSWORD_MESSAGES.SEND_PENDING : FORGOT_PASSWORD_MESSAGES.SEND_ACTION}
      </Button>
    </form>
  )
}
