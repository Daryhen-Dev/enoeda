"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { AUTH_MESSAGES } from "@/lib/localization/es-ec"
import { createClient as createBrowserClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleLogout() {
    setIsPending(true)
    setErrorMessage(null)

    try {
      const { error } = await createBrowserClient().auth.signOut()

      if (error) {
        setErrorMessage(AUTH_MESSAGES.LOGOUT_FAILURE)
        return
      }

      router.replace("/login")
      router.refresh()
    } catch {
      setErrorMessage(AUTH_MESSAGES.LOGOUT_FAILURE)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {errorMessage ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        aria-busy={isPending}
        disabled={isPending}
        onClick={handleLogout}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? AUTH_MESSAGES.LOGOUT_PENDING : AUTH_MESSAGES.LOGOUT_ACTION}
      </Button>
    </div>
  )
}
