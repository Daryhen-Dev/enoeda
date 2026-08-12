import {
  BranchManager,
  BRANCH_DIRECTORY_STATUS,
  type BranchDirectoryResult,
} from "@/components/branches/branch-manager"
import { listBranches } from "@/lib/domain/branches/actions"

export default async function BranchesPage() {
  const result = await listBranches()
  const directoryResult: BranchDirectoryResult = result.success
    ? { status: BRANCH_DIRECTORY_STATUS.READY, branches: result.data ?? [] }
    : {
        status: BRANCH_DIRECTORY_STATUS.ERROR,
        error: result.error ?? "Unable to load branches. Please try again later.",
      }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <BranchManager result={directoryResult} />
    </div>
  )
}
