import Link from "next/link"
import { BuildingIcon, UsersIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardKpis } from "@/lib/domain/dashboard"

export default async function DashboardOverview() {
  const result = await getDashboardKpis()
  const dashboard = result.success && result.data !== undefined ? result.data : null
  const branchCountLabel =
    dashboard === null ? "Unavailable" : dashboard.active_branch_count.toLocaleString()
  const activeStudentCountLabel =
    dashboard === null ? "Unavailable" : dashboard.active_student_count.toLocaleString()
  const inactiveStudentCountLabel =
    dashboard === null
      ? "Unavailable"
      : dashboard.inactive_student_count.toLocaleString()

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">Welcome to Enoeda Academy</h2>
        <p className="text-sm text-muted-foreground">
          Your academy management workspace is ready for you.
        </p>
      </div>

      {dashboard === null && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Overview data is temporarily unavailable. You can still open each
          management area directly.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/branches"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <BuildingIcon className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle>Branches</CardTitle>
                  <CardDescription>Active academy locations.</CardDescription>
                </div>
                <span
                  aria-label={`${branchCountLabel} active branches`}
                  className="text-2xl font-semibold tabular-nums"
                >
                  {branchCountLabel}
                </span>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/dashboard/students"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <UsersIcon className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle>Active Students</CardTitle>
                  <CardDescription>Active student records.</CardDescription>
                </div>
                <span
                  aria-label={`${activeStudentCountLabel} active students`}
                  className="text-2xl font-semibold tabular-nums"
                >
                  {activeStudentCountLabel}
                </span>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <UsersIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle>Inactive Students</CardTitle>
                <CardDescription>Student records marked inactive.</CardDescription>
              </div>
              <span
                aria-label={`${inactiveStudentCountLabel} inactive students`}
                className="text-2xl font-semibold tabular-nums"
              >
                {inactiveStudentCountLabel}
              </span>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active students by branch</CardTitle>
          <CardDescription>
            Active student records across active academy locations.
          </CardDescription>
          {dashboard === null ? (
            <p className="text-sm text-muted-foreground">
              Branch distribution is unavailable.
            </p>
          ) : dashboard.active_students_by_branch.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active branches are available.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Active students by branch">
              {dashboard.active_students_by_branch.map((branch) => (
                <li
                  key={branch.branch_id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="font-medium">{branch.branch_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {branch.active_student_count.toLocaleString()} active
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardHeader>
      </Card>
    </div>
  )
}
