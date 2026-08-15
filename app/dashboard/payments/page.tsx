import { getAuthenticatedContext } from "@/lib/auth/server-context"
import { getOverdueStudents } from "@/lib/domain/payments/actions"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import { OverdueStudentsList } from "@/components/payments/overdue-students-list"
import { ClassPriceConfigDialog } from "@/components/payments/class-price-config-dialog"
import { OVERDUE_MESSAGES } from "@/lib/localization/es-ec"

export default async function PaymentsPage() {
  const [authResult, overdueResult, disciplinesResult] = await Promise.all([
    getAuthenticatedContext(),
    getOverdueStudents(),
    listDisciplines(),
  ])

  const isAdmin =
    authResult.ok &&
    authResult.ctx.roles.some((r) => r === "admin" || r === "owner")

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

      {isAdmin && (
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
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
