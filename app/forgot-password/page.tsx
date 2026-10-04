import Link from "next/link"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { FORGOT_PASSWORD_MESSAGES } from "@/lib/localization/es-ec"

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {FORGOT_PASSWORD_MESSAGES.PAGE_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {FORGOT_PASSWORD_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm">
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/login"
          >
            {FORGOT_PASSWORD_MESSAGES.BACK_TO_LOGIN}
          </Link>
        </p>
      </section>
    </main>
  )
}
