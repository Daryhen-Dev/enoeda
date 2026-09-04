"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseRoleAssignments, roleNamesFrom } from "@/lib/auth/authorize"
import {
  getSafeRedirect,
  getStudentAuthHome,
  type SafeRedirect,
} from "@/lib/auth/redirect"
import { AUTH_MESSAGES } from "@/lib/localization/es-ec"
import { createClient as createBrowserClient } from "@/lib/supabase/client"

interface LoginFormProps {
  redirectTo: SafeRedirect
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email")
    const password = formData.get("password")

    if (typeof email !== "string" || typeof password !== "string") {
      setErrorMessage(AUTH_MESSAGES.LOGIN_FAILURE)
      setIsPending(false)
      return
    }

    try {
      const supabase = createBrowserClient()
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || signInData.user === null) {
        setErrorMessage(AUTH_MESSAGES.LOGIN_FAILURE)
        return
      }

      const { data: rolesData, error: rolesError } = await supabase.rpc(
        "current_roles"
      )
      if (rolesError) {
        setErrorMessage(AUTH_MESSAGES.LOGIN_FAILURE)
        return
      }

      const roles = roleNamesFrom(parseRoleAssignments(rolesData))
      if (roles.length > 0) {
        router.replace(getSafeRedirect(redirectTo, roles))
        router.refresh()
        return
      }

      const studentResult = await supabase
        .from("students")
        .select("id")
        .eq("auth_user_id", signInData.user.id)
        .maybeSingle()

      if (studentResult.error) {
        setErrorMessage(AUTH_MESSAGES.LOGIN_FAILURE)
        return
      }

      router.replace(getStudentAuthHome(studentResult.data !== null))
      router.refresh()
    } catch {
      setErrorMessage(AUTH_MESSAGES.LOGIN_FAILURE)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          {AUTH_MESSAGES.EMAIL_LABEL}
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
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          {AUTH_MESSAGES.PASSWORD_LABEL}
        </label>
        <Input
          autoComplete="current-password"
          disabled={isPending}
          id="password"
          name="password"
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
        {isPending ? AUTH_MESSAGES.LOGIN_PENDING : AUTH_MESSAGES.LOGIN_ACTION}
      </Button>
    </form>
  )
}
