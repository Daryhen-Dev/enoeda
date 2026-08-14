import { AlertCircleIcon, BuildingIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchList } from "@/components/owner/branch-list"
import { listBranches } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Owner control-plane overview — shows all branches.
 */
export default async function OwnerPage() {
  const result = await listBranches({ status: "active" })
  const inactiveResult = await listBranches({ status: "inactive" })

  const allBranches = [
    ...(result.success ? result.data ?? [] : []),
    ...(inactiveResult.success ? inactiveResult.data ?? [] : []),
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <BuildingIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {OWNER_MESSAGES.OVERVIEW}
          </h2>
          <p className="text-sm text-muted-foreground">
            {OWNER_MESSAGES.OVERVIEW_DESCRIPTION}
          </p>
        </div>
      </div>

      {!result.success && !inactiveResult.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OWNER_MESSAGES.BRANCHES}</AlertTitle>
          <AlertDescription>{OWNER_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      ) : (
        <BranchList branches={allBranches} />
      )}
    </div>
  )
}
