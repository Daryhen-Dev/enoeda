import { redirect } from "next/navigation"

import { BranchSelector } from "@/components/branch/branch-selector"
import { PaymentSettingsForm } from "@/components/payments/payment-settings-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { getBranchPaymentSettings } from "@/lib/domain/branches/actions"
import { PAYMENT_MESSAGES } from "@/lib/localization/es-ec"

interface PaymentSettingsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function PaymentSettingsPage({ searchParams }: PaymentSettingsPageProps) {
  const params = await searchParams
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/payments/settings?${redirectParams.toString()}`)
  }

  if (branchResult.type === "selector") {
    const currentParams = Object.fromEntries(
      Object.entries(params).filter(([key, value]) => key !== "branch" && value)
    ) as Record<string, string>
    return <BranchSelector branches={branchResult.branches} currentPath="/dashboard/payments/settings" currentParams={currentParams} />
  }

  if (branchResult.type === "error" || !branchResult.canManage) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_MESSAGES.SETTINGS_TITLE}</AlertTitle>
          <AlertDescription>{PAYMENT_MESSAGES.CORRECTIONS_LOCKED}</AlertDescription>
        </Alert>
      </main>
    )
  }

  const settingsResult = await getBranchPaymentSettings(branchResult.branchId)
  if (!settingsResult.success || !settingsResult.data) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_MESSAGES.SETTINGS_TITLE}</AlertTitle>
          <AlertDescription>{settingsResult.error ?? PAYMENT_MESSAGES.SETTINGS_UNAVAILABLE}</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{PAYMENT_MESSAGES.SETTINGS_TITLE}</h1>
        <p className="text-sm text-muted-foreground">{PAYMENT_MESSAGES.SETTINGS_DESCRIPTION}</p>
      </div>
      <PaymentSettingsForm branchId={branchResult.branchId} settings={settingsResult.data} />
    </main>
  )
}
