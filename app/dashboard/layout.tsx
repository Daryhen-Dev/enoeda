import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { APP_ROLES } from "@/lib/auth/authorize"
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver"
import { getOperationalBranchIds, resolveActiveBranches } from "@/lib/auth/operational-branches"
import { getOwnProfile } from "@/lib/domain/profile"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

const dashboardLayoutStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [profileResult, identityResult] = await Promise.all([getOwnProfile(), getAuthenticatedContext()])
  const roles = identityResult.ok ? identityResult.ctx.roles : []
  const isAdmin = roles.includes(APP_ROLES.ADMIN)
  const canManageProfile = roles.includes(APP_ROLES.ADMIN) || roles.includes(APP_ROLES.TEACHER)
  const isTeacherOnly = identityResult.ok && identityResult.ctx.roles.includes(APP_ROLES.TEACHER) && !identityResult.ctx.roles.includes(APP_ROLES.ADMIN)
  const displayName = canManageProfile && profileResult.success && profileResult.data
    ? `${profileResult.data.first_name} ${profileResult.data.surname}`.trim() || DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE
    : DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE

  const headerBranches = await (async () => {
    if (!identityResult.ok) return { branches: [], globalReadBranches: [] }
    const ids = getOperationalBranchIds(identityResult.ctx.assignments)
    if (ids.length === 0) return { branches: [], globalReadBranches: [] }
    const { listBranches } = await import("@/lib/domain/branches/actions")
    const result = await listBranches()
    if (!result.success || !result.data) return { branches: [], globalReadBranches: [] }
    const branches = resolveActiveBranches(ids, result.data)
    const hasActiveAdminAssignment = identityResult.ctx.assignments.some(
      (assignment) => assignment.role === APP_ROLES.ADMIN && assignment.branchId !== null && branches.some((branch) => branch.id === assignment.branchId)
    )
    return {
      branches,
      globalReadBranches: hasActiveAdminAssignment
        ? result.data.map((branch) => ({ id: branch.id, name: branch.name }))
        : [],
    }
  })()

  return <TooltipProvider><SidebarProvider style={dashboardLayoutStyle}>
    <AppSidebar canManageProfile={canManageProfile} isAdmin={isAdmin} isTeacherOnly={isTeacherOnly} variant="inset" />
    <SidebarInset>
      <SiteHeader displayName={displayName} branches={headerBranches.branches} globalReadBranches={headerBranches.globalReadBranches} />
      <div className="flex flex-1 flex-col"><div className="@container/main flex flex-1 flex-col gap-2">{children}</div></div>
    </SidebarInset>
  </SidebarProvider></TooltipProvider>
}
