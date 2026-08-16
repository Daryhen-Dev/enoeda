"use client"

import Link from "next/link"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

interface SiteHeaderProps {
  displayName: string
  canManageProfile: boolean
}

export function SiteHeader({
  displayName,
  canManageProfile,
}: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">
          {DASHBOARD_SHELL_MESSAGES.OVERVIEW}
        </h1>
        <span className="text-sm text-muted-foreground">{displayName}</span>
        {canManageProfile ? (
          <Link
            className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
            href="/dashboard/profile"
          >
            {DASHBOARD_SHELL_MESSAGES.PROFILE}
          </Link>
        ) : null}
      </div>
    </header>
  )
}
