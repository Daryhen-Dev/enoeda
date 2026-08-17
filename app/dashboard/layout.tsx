import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchCurrentRoles } from "@/lib/auth/server-roles"
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver"
import { getOwnProfile } from "@/lib/domain/profile"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

const dashboardLayoutStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const [roles, profileResult, identityResult] = await Promise.all([
    fetchCurrentRoles(),
    getOwnProfile(),
    getAuthenticatedContext(),
  ])
  const isAdmin = roles.includes("admin")
  const canManageProfile = roles.includes("admin") || roles.includes("teacher")
  const displayName =
    canManageProfile && profileResult.success && profileResult.data
      ? `${profileResult.data.first_name} ${profileResult.data.surname}`.trim() ||
        DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE
      : DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE

  // Extract unique branch IDs from assignments for SiteHeader switcher
  // Layout does NOT resolve ?branch — pages handle that individually
  // Resolve actual branch names from DB (never show UUIDs)
  const branches: { id: string; name: string }[] = await (async () => {
    if (!identityResult.ok) return []
    const seen = new Set<string>()
    const ids: string[] = []
    for (const a of identityResult.ctx.assignments) {
      if (a.branchId && !seen.has(a.branchId)) {
        seen.add(a.branchId)
        ids.push(a.branchId)
      }
    }
    if (ids.length === 0) return []

    const { listBranches } = await import("@/lib/domain/branches/actions")
    const branchesResult = await listBranches()
    if (!branchesResult.success || !branchesResult.data) {
      return ids.map((id) => ({ id, name: id }))
    }
    const nameMap = new Map(
      branchesResult.data
        .filter((b) => b.is_active)
        .map((b) => [b.id, b.name])
    )
    return ids.map((id) => ({ id, name: nameMap.get(id) ?? id }))
  })()

  return (
    <TooltipProvider>
      <SidebarProvider style={dashboardLayoutStyle}>
        <AppSidebar
          canManageProfile={canManageProfile}
          isAdmin={isAdmin}
          variant="inset"
        />
        <SidebarInset>
          <SiteHeader
            displayName={displayName}
            branches={branches}
          />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
