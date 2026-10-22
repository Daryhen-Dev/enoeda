"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AUTH_MESSAGES } from "@/lib/localization/es-ec"
import { createClient as createBrowserClient } from "@/lib/supabase/client"

interface LogoutButtonProps {
  /**
   * "sidebar" sits on the ink rail: hairline border and sidebar ink text, so
   * it stays legible on --sidebar. "default" is the outline button for paper
   * surfaces.
   */
  tone?: "default" | "sidebar"
}

export function LogoutButton({ tone = "default" }: LogoutButtonProps) {
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
        <p
          aria-live="polite"
          className={cn(
            "text-sm",
            tone === "sidebar" ? "text-sidebar-foreground" : "text-destructive"
          )}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <Button
        aria-busy={isPending}
        disabled={isPending}
        onClick={handleLogout}
        size="sm"
        type="button"
        variant={tone === "sidebar" ? "ghost" : "outline"}
        className={cn(
          tone === "sidebar" &&
            "border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
        )}
      >
        {isPending ? AUTH_MESSAGES.LOGOUT_PENDING : AUTH_MESSAGES.LOGOUT_ACTION}
      </Button>
    </div>
  )
}
