import type { CSSProperties, ReactNode } from "react"
import { redirect } from "next/navigation"

import { OwnerSidebar } from "@/components/owner/owner-sidebar"
import { OwnerHeader } from "@/components/owner/owner-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchCurrentRoles } from "@/lib/auth/server-roles"
import { APP_ROLES } from "@/lib/auth/authorize"

const ownerLayoutStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties

/**
 * Owner control-plane shell.
 * Resolves identity server-side and enforces owner-only access as
 * defense-in-depth (middleware already guards `/owner` routes).
 */
export default async function OwnerLayout({
  children,
}: {
  children: ReactNode
}) {
  const roles = await fetchCurrentRoles()

  if (!roles.includes(APP_ROLES.OWNER)) {
    redirect("/login")
  }

  return (
    <TooltipProvider>
      <SidebarProvider style={ownerLayoutStyle}>
        <OwnerSidebar variant="inset" />
        <SidebarInset>
          <OwnerHeader />
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
