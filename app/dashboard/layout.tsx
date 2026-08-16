import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchCurrentRoles } from "@/lib/auth/server-roles"
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
  const [roles, profileResult] = await Promise.all([
    fetchCurrentRoles(),
    getOwnProfile(),
  ])
  const isAdmin = roles.includes("admin")
  const canManageProfile = roles.includes("admin") || roles.includes("teacher")
  const displayName =
    canManageProfile && profileResult.success && profileResult.data
      ? `${profileResult.data.first_name} ${profileResult.data.surname}`.trim() ||
        DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE
      : DASHBOARD_SHELL_MESSAGES.PROFILE_NAME_UNAVAILABLE

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
            canManageProfile={canManageProfile}
            displayName={displayName}
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
