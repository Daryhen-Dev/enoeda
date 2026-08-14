import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { CHANGE_PASSWORD_MESSAGES } from "@/lib/localization/es-ec"

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {CHANGE_PASSWORD_MESSAGES.PAGE_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {CHANGE_PASSWORD_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
        <ChangePasswordForm />
      </section>
    </main>
  )
}
