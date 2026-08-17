"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { BuildingIcon, ChevronDownIcon } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

interface BranchInfo {
  id: string
  name: string
}

interface SiteHeaderProps {
  displayName: string
  branches?: BranchInfo[]
  currentBranchId?: string
}

export function SiteHeader({
  displayName,
  branches,
  currentBranchId,
}: SiteHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleBranchChange = (branchId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("branch", branchId)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const currentBranch = branches?.find((b) => b.id === currentBranchId)
  const showSwitcher = branches && branches.length > 1

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full flex-col gap-1 px-4 sm:flex-row sm:items-center sm:gap-2 lg:px-6">
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto"
          />
          <h1 className="truncate text-base font-medium">
            {DASHBOARD_SHELL_MESSAGES.OVERVIEW}
          </h1>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:ml-auto sm:gap-2">
          {showSwitcher && (
            <div className="relative">
              <label htmlFor="branch-switcher" className="sr-only">
                Cambiar sucursal
              </label>
              <select
                id="branch-switcher"
                value={currentBranchId ?? ""}
                onChange={(e) => handleBranchChange(e.target.value)}
                aria-label="Sucursal activa"
                className="appearance-none truncate rounded-md border bg-background py-1 pl-8 pr-7 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <BuildingIcon
                className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <ChevronDownIcon
                className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}

          {!showSwitcher && currentBranch && (
            <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <BuildingIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{currentBranch.name}</span>
            </span>
          )}

          <span className="truncate text-sm text-muted-foreground">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  )
}
