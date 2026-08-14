import { notFound } from "next/navigation"
import { AlertCircleIcon, UsersIcon } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AdminAssignment } from "@/components/owner/admin-assignment"
import { getBranch } from "@/lib/domain/branches/actions"
import { listBranchStaff } from "@/lib/domain/roles/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

interface AdminsPageProps {
  params: Promise<{ id: string }>
}

/**
 * Owner admin-assignment page — list and manage branch admins.
 */
export default async function AdminsPage({ params }: AdminsPageProps) {
  const { id } = await params
  const branchResult = await getBranch(id)

  if (!branchResult.success) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OWNER_MESSAGES.ADMINS_TITLE}</AlertTitle>
          <AlertDescription>{OWNER_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!branchResult.data) {
    notFound()
  }

  const staffResult = await listBranchStaff()
  const admins = (staffResult.success ? staffResult.data ?? [] : []).filter(
    (a) => a.branch_id === id && a.role === "admin"
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <UsersIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {branchResult.data.name} — {OWNER_MESSAGES.ADMINS_TITLE}
          </h2>
          <p className="text-sm text-muted-foreground">
            {OWNER_MESSAGES.ADMINS_DESCRIPTION}
          </p>
        </div>
      </div>

      <nav className="text-sm text-muted-foreground">
        <Link
          href="/owner/branches"
          className="text-primary underline-offset-4 hover:underline"
        >
          {OWNER_MESSAGES.BRANCHES}
        </Link>
        {" / "}
        {branchResult.data.name}
        {" / "}
        {OWNER_MESSAGES.ADMINS_TITLE}
      </nav>

      <AdminAssignment branchId={id} admins={admins} />
    </div>
  )
}
