import { LoginForm } from "@/components/auth/login-form"
import { getSafeRedirect } from "@/lib/auth/redirect"
import { AUTH_MESSAGES } from "@/lib/localization/es-ec"

type LoginSearchParams = Record<string, unknown>

interface LoginPageProps {
  searchParams?: LoginSearchParams | Promise<LoginSearchParams>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams
  const redirectTo = getSafeRedirect(resolvedSearchParams?.redirect)

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {AUTH_MESSAGES.LOGIN_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {AUTH_MESSAGES.LOGIN_DESCRIPTION}
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </section>
    </main>
  )
}
