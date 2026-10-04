import { redirect } from "next/navigation"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { getAuthenticatedContext } from "@/lib/auth/server-context"
import { getStudentIdentity } from "@/lib/auth/student-identity-resolver"
import { RESET_PASSWORD_MESSAGES } from "@/lib/localization/es-ec"

export default async function ResetPasswordPage() {
  const auth = await getAuthenticatedContext()

  let roleHome: "/dashboard" | "/student"
  if (auth.ok) {
    roleHome = "/dashboard"
  } else {
    const student = await getStudentIdentity()
    if (!student.ok) {
      // No recovery session: ask for the email again.
      redirect("/forgot-password")
    }
    roleHome = "/student"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {RESET_PASSWORD_MESSAGES.PAGE_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {RESET_PASSWORD_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
        <ResetPasswordForm roleHome={roleHome} />
      </section>
    </main>
  )
}
