"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { changeOwnPassword } from "@/lib/auth/change-password"
import { CHANGE_PASSWORD_MESSAGES, RESET_PASSWORD_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

interface ResetPasswordFormProps {
  roleHome: "/dashboard" | "/student"
}

export function ResetPasswordForm({ roleHome }: ResetPasswordFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)
    const newPassword = formData.get("newPassword")
    const confirmPassword = formData.get("confirmPassword")

    if (typeof newPassword !== "string" || typeof confirmPassword !== "string") {
      setErrorMessage(RESET_PASSWORD_MESSAGES.FAILURE)
      setIsPending(false)
      return
    }

    const result = await changeOwnPassword({ newPassword, confirmPassword })

    if (!result.success) {
      setErrorMessage(result.error ?? RESET_PASSWORD_MESSAGES.FAILURE)
      setIsPending(false)
      return
    }

    toast.success(TOAST_MESSAGES.PASSWORD_CHANGED)
    router.push(roleHome)
    router.refresh()
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="newPassword">
          {CHANGE_PASSWORD_MESSAGES.NEW_PASSWORD_LABEL}
        </label>
        <input
          autoComplete="new-password"
          className="flex h-9 w-full rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
          id="newPassword"
          minLength={8}
          name="newPassword"
          required
          type="password"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          {CHANGE_PASSWORD_MESSAGES.CONFIRM_PASSWORD_LABEL}
        </label>
        <input
          autoComplete="new-password"
          className="flex h-9 w-full rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
          id="confirmPassword"
          name="confirmPassword"
          required
          type="password"
        />
      </div>
      {errorMessage ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button aria-busy={isPending} className="w-full" disabled={isPending} type="submit">
        {isPending ? RESET_PASSWORD_MESSAGES.PENDING : RESET_PASSWORD_MESSAGES.ACTION}
      </Button>
    </form>
  )
}
