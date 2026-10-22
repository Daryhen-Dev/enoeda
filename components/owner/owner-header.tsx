"use client"

import { EnoedaMark } from "@/components/brand/enoeda-mark"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

export function OwnerHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-sidebar border-sidebar-border text-sidebar-foreground transition-[width,height] ease-linear md:border-border md:bg-background md:text-foreground group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring md:text-foreground md:hover:bg-muted md:hover:text-foreground md:focus-visible:ring-ring/50" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 bg-sidebar-border data-vertical:self-auto md:bg-border"
        />
        {/* Below md the header is the ink top bar; the emblem fronts it. */}
        <EnoedaMark className="size-6 shrink-0 md:hidden" />
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-sidebar-accent-foreground sm:text-xl md:text-foreground">
          {OWNER_MESSAGES.CONTROL_PLANE}
        </h1>
      </div>
    </header>
  )
}
