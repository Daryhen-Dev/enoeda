"use client"

import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { SidebarStyleProvider } from "./sidebar/sidebar-root"
import { SidebarStateProvider } from "./sidebar/sidebar-state-provider"
import type { SidebarStyle } from "./sidebar/types"

const SIDEBAR_PROVIDER_DEFAULT_STYLE: SidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
  "--sidebar-width-icon-floating":
    "calc(var(--sidebar-width-icon) + var(--spacing) * 4)",
  "--sidebar-width-icon-floating-with-border":
    "calc(var(--sidebar-width-icon) + var(--spacing) * 4 + 2px)",
}

type SidebarProviderProps = Omit<ComponentProps<"div">, "style"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  style?: SidebarStyle
}

export function SidebarProvider({
  defaultOpen = true,
  open,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const sidebarStyle: SidebarStyle = {
    ...SIDEBAR_PROVIDER_DEFAULT_STYLE,
    ...style,
  }

  return (
    <SidebarStateProvider
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SidebarStyleProvider style={sidebarStyle}>
        <div
          data-slot="sidebar-wrapper"
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
            className
          )}
          style={sidebarStyle}
          {...props}
        >
          {children}
        </div>
      </SidebarStyleProvider>
    </SidebarStateProvider>
  )
}

export { Sidebar } from "./sidebar/sidebar-root"
export {
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
} from "./sidebar/sidebar-controls"
export {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarSeparator,
} from "./sidebar/sidebar-structure"
export {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./sidebar/sidebar-menu"
export { useSidebarState as useSidebar } from "./sidebar/sidebar-state-provider"
