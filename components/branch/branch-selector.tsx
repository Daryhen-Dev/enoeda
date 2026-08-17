/**
 * Branch selection UI — rendered when a multi-branch user has no valid
 * ?branch param. Blocks page content until a branch is chosen.
 *
 * Server-rendered, accessible, responsive.
 */

import { BuildingIcon } from "lucide-react"
import Link from "next/link"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"

interface BranchOption {
  id: string
  name: string
}

interface BranchSelectorProps {
  branches: BranchOption[]
  /** Current pathname to preserve when building branch links */
  currentPath: string
  /** Current search params to preserve (minus ?branch) */
  currentParams: Record<string, string>
}

export function BranchSelector({
  branches,
  currentPath,
  currentParams,
}: BranchSelectorProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 md:p-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Seleccione una sucursal</h2>
        <p className="text-sm text-muted-foreground">
          Tiene acceso a múltiples sucursales. Seleccione una para continuar.
        </p>
      </div>
      <div
        className="grid w-full max-w-lg gap-3"
        role="list"
        aria-label="Sucursales disponibles"
      >
        {branches.map((branch) => {
          const params = new URLSearchParams(currentParams)
          params.set("branch", branch.id)
          const href = `${currentPath}?${params.toString()}`

          return (
            <Link
              key={branch.id}
              href={href}
              className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              role="listitem"
            >
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex-row items-center gap-3 py-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <BuildingIcon className="size-5 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{branch.name}</CardTitle>
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
