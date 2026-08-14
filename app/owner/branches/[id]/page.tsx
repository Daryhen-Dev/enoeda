import { notFound } from "next/navigation"
import { AlertCircleIcon, BuildingIcon } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BranchDetail } from "@/components/owner/branch-detail"
import { getBranch } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

interface BranchDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Owner branch detail page — edit branch metadata and activate/deactivate.
 */
export default async function BranchDetailPage({ params }: BranchDetailPageProps) {
  const { id } = await params
  const result = await getBranch(id)

  if (!result.success) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OWNER_MESSAGES.BRANCHES}</AlertTitle>
          <AlertDescription>{OWNER_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!result.data) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <BuildingIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{result.data.name}</h2>
          <p className="text-sm text-muted-foreground">
            {OWNER_MESSAGES.BRANCH_DETAIL_DESCRIPTION}
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
        {result.data.name}
        {" / "}
        <Link
          href={`/owner/branches/${id}/admins`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {OWNER_MESSAGES.ADMINS_TITLE}
        </Link>
      </nav>

      <BranchDetail branch={result.data} />
    </div>
  )
}
