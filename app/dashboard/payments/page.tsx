import { redirect } from "next/navigation"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchSelector } from "@/components/branch/branch-selector"
import { getOverdueStudents } from "@/lib/domain/payments/actions"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import { OverdueStudentsList } from "@/components/payments/overdue-students-list"
import { ClassPriceConfigDialog } from "@/components/payments/class-price-config-dialog"
import { resolveBranchContext } from "@/lib/auth/branch-context"
import { OVERDUE_MESSAGES } from "@/lib/localization/es-ec"

interface PaymentsPageProps {
  searchParams: Promise<{ branch?: string; [key: string]: string | undefined }>
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams

  // Page-level branch context resolution (never in layout)
  const branchResult = await resolveBranchContext(params.branch)

  if (branchResult.type === "error") {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OVERDUE_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>
            {OVERDUE_MESSAGES.NO_BRANCH_CONTEXT}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (branchResult.type === "redirect") {
    const redirectParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key !== "branch" && value) redirectParams.set(key, value)
    }
    redirectParams.set("branch", branchResult.branchId)
    redirect(`/dashboard/payments?${redirectParams.toString()}`)
  }

  if (branchResult.type === "selector") {
    const { branch: _, ...otherParams } = params
    return (
      <BranchSelector
        branches={branchResult.branches}
        currentPath="/dashboard/payments"
        currentParams={otherParams as Record<string, string>}
      />
    )
  }

  // Valid branch — scoped data reads
  const canManage = branchResult.canManage

  const [overdueResult, disciplinesResult] = await Promise.all([
    getOverdueStudents(branchResult.branchId),
    listDisciplines(),
  ])

  const overdueStudents =
    overdueResult.success && overdueResult.data ? overdueResult.data : []

  const disciplines =
    disciplinesResult.success && disciplinesResult.data
      ? disciplinesResult.data
      : []

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {OVERDUE_MESSAGES.PAGE_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {OVERDUE_MESSAGES.PAGE_DESCRIPTION}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{OVERDUE_MESSAGES.LIST_TITLE}</h2>
        <p className="text-sm text-muted-foreground">
          {OVERDUE_MESSAGES.LIST_DESCRIPTION}
        </p>
        <OverdueStudentsList students={overdueStudents} />
      </section>

      {canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {OVERDUE_MESSAGES.PRICING_SECTION_TITLE}
          </h2>
          <p className="text-sm text-muted-foreground">
            {OVERDUE_MESSAGES.PRICING_SECTION_DESCRIPTION}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {disciplines.map((d) => (
              <ClassPriceConfigDialog
                key={d.id}
                disciplineId={d.id}
                disciplineName={d.name}
                branchId={branchResult.branchId}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
