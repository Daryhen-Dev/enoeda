"use client"

import { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { BuildingIcon, ChevronDownIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
}

/**
 * Builds the URL for a branch switch, preserving pathname and all query params.
 * Pure function — extracted for testability.
 */
export function buildBranchSwitchUrl(
  pathname: string,
  existingParams: string,
  newBranchId: string
): string {
  const params = new URLSearchParams(existingParams)
  params.set("branch", newBranchId)
  return `${pathname}?${params.toString()}`
}

/**
 * Determines switcher eligibility.
 * Pure function — extracted for testability.
 */
export function getSwitcherMode(
  branches: BranchInfo[] | undefined
): "select" | "static" | "hidden" {
  if (!branches || branches.length === 0) return "hidden"
  if (branches.length === 1) return "static"
  return "select"
}

export function SiteHeader({
  displayName,
  branches,
}: SiteHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Derive current branch exclusively from URL search params
  const currentBranchId = searchParams.get("branch") ?? undefined

  const handleBranchChange = (branchId: string) => {
    const url = buildBranchSwitchUrl(
      pathname,
      searchParams.toString(),
      branchId
    )
    router.replace(url)
    setDrawerOpen(false)
  }

  const currentBranch = branches?.find((b) => b.id === currentBranchId)
  const mode = getSwitcherMode(branches)

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
          {mode === "select" && branches && (
            <>
              {/* Desktop: native select (compact, accessible) */}
              <div className="relative hidden sm:block">
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

              {/* Mobile: bottom-sheet drawer (accessible overlay) */}
              <div className="sm:hidden">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <DrawerTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Cambiar sucursal"
                      />
                    }
                  >
                    <BuildingIcon className="size-4" aria-hidden="true" />
                    <span className="max-w-30 truncate">
                      {currentBranch?.name ?? "Sucursal"}
                    </span>
                    <ChevronDownIcon
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Seleccionar sucursal</DrawerTitle>
                    </DrawerHeader>
                    <div
                      className="flex flex-col gap-1 p-4"
                      aria-label="Sucursales disponibles"
                    >
                      {branches.map((branch) => (
                        <DrawerClose
                          key={branch.id}
                          render={
                            <button
                              type="button"
                              onClick={() => handleBranchChange(branch.id)}
                              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            />
                          }
                        >
                          <span className="flex items-center gap-2">
                            <BuildingIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            {branch.name}
                          </span>
                          {branch.id === currentBranchId && (
                            <CheckIcon
                              className="size-4 text-primary"
                              aria-hidden="true"
                            />
                          )}
                        </DrawerClose>
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </>
          )}

          {mode === "static" && currentBranch && (
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
