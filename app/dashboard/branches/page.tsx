import {
  BranchManager,
  BRANCH_DIRECTORY_STATUS,
  type BranchDirectoryResult,
} from "@/components/branches/branch-manager"
import { listBranches } from "@/lib/domain/branches/actions"
import { BRANCH_STATUS } from "@/lib/domain/branches/schema"

function toDirectoryResult(
  result: Awaited<ReturnType<typeof listBranches>>
): BranchDirectoryResult {
  return result.success
    ? { status: BRANCH_DIRECTORY_STATUS.READY, branches: result.data ?? [] }
    : {
        status: BRANCH_DIRECTORY_STATUS.ERROR,
        error: result.error ?? "Unable to load branches. Please try again later.",
      }
}

export default async function BranchesPage() {
  const [activeResult, historyResult] = await Promise.all([
    listBranches({ status: BRANCH_STATUS.ACTIVE }),
    listBranches({ status: BRANCH_STATUS.INACTIVE }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <BranchManager
        activeResult={toDirectoryResult(activeResult)}
        historyResult={toDirectoryResult(historyResult)}
      />
    </div>
  )
}
