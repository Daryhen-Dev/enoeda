import Link from "next/link"
import { GavelIcon, UserSearchIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { DASHBOARD_OVERVIEW_MESSAGES } from "@/lib/localization/es-ec"

interface OverviewQuickActionsProps {
  branchId: string
}

/**
 * Quick access strip for the "Hoy" overview: the two things an admin or a
 * teacher reaches for between classes — record a fine or a warning, and look a
 * student up. Branch-scoped links, so the active branch survives the jump.
 */
export function OverviewQuickActions({ branchId }: OverviewQuickActionsProps) {
  const branchQuery = `branch=${encodeURIComponent(branchId)}`

  return (
    <nav
      aria-label={DASHBOARD_OVERVIEW_MESSAGES.QUICK_ACTIONS_TITLE}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
    >
      <Link
        href={`/dashboard/conduct?${branchQuery}`}
        className={`${buttonVariants({ variant: "outline" })} min-h-11 w-full justify-start sm:min-h-9 sm:w-auto`}
      >
        <GavelIcon className="size-4" aria-hidden="true" />
        {DASHBOARD_OVERVIEW_MESSAGES.QUICK_ACTION_CONDUCT}
      </Link>
      <Link
        href={`/dashboard/students?${branchQuery}`}
        className={`${buttonVariants({ variant: "outline" })} min-h-11 w-full justify-start sm:min-h-9 sm:w-auto`}
      >
        <UserSearchIcon className="size-4" aria-hidden="true" />
        {DASHBOARD_OVERVIEW_MESSAGES.QUICK_ACTION_STUDENTS}
      </Link>
    </nav>
  )
}
