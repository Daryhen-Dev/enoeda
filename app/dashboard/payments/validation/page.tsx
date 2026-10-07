import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { buildQuery } from "@/components/payments/monthly-payment-validation-format"
import MonthlyPaymentValidationSection from "@/components/payments/monthly-payment-validation-section"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { PAYMENT_VALIDATION_MESSAGES } from "@/lib/localization/es-ec"

interface ValidationPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function PaymentValidationPage({
  searchParams,
}: ValidationPageProps) {
  const params = await searchParams
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/payments/validation?${redirectParams.toString()}`)
  }

  if (branchResult.type === "error" || !branchResult.canManage) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_VALIDATION_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {PAYMENT_VALIDATION_MESSAGES.NOT_AUTHORIZED}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <Link
          href={`/dashboard/payments?${buildQuery(branchResult.branchId)}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {PAYMENT_VALIDATION_MESSAGES.BACK_LINK}
        </Link>
      </div>

      <MonthlyPaymentValidationSection
        branchId={branchResult.branchId}
        timeZone={branchResult.timeZone}
        headingLevel="h1"
      />
    </main>
  )
}
