import Link from "next/link"
import { BuildingIcon, UsersIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getActiveBranchCount } from "@/lib/domain/branches/actions"
import { getActiveStudentCount } from "@/lib/domain/students/actions"

export default async function DashboardOverview() {
  const [branchCountResult, studentCountResult] = await Promise.all([
    getActiveBranchCount(),
    getActiveStudentCount(),
  ])
  const branchCount = branchCountResult.success
    ? branchCountResult.data?.count ?? null
    : null
  const studentCount = studentCountResult.success
    ? studentCountResult.data?.count ?? null
    : null
  const hasUnavailableCount = branchCount === null || studentCount === null
  const summaryCards = [
    {
      title: "Branches",
      description: "Active academy locations.",
      href: "/dashboard/branches",
      icon: BuildingIcon,
      count: branchCount,
    },
    {
      title: "Students",
      description: "Active student records.",
      href: "/dashboard/students",
      icon: UsersIcon,
      count: studentCount,
    },
  ] as const

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">Welcome to Enoeda Academy</h2>
        <p className="text-sm text-muted-foreground">
          Your academy management workspace is ready for you.
        </p>
      </div>

      {hasUnavailableCount && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Overview data is temporarily unavailable. You can still open each
          management area directly.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCards.map((card) => {
          const Icon = card.icon
          const countLabel =
            card.count === null ? "Unavailable" : card.count.toLocaleString()

          return (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle>{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </div>
                    <span
                      aria-label={`${countLabel} active ${card.title.toLowerCase()}`}
                      className="text-2xl font-semibold tabular-nums"
                    >
                      {countLabel}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
