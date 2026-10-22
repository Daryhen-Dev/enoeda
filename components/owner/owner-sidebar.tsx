"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenIcon,
  BuildingIcon,
  LayoutDashboardIcon,
} from "lucide-react"

import { LogoutButton } from "@/components/auth/logout-button"
import { EnoedaMark } from "@/components/brand/enoeda-mark"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

const navigationItems = [
  {
    title: OWNER_MESSAGES.OVERVIEW,
    url: "/owner",
    icon: LayoutDashboardIcon,
  },
  {
    title: OWNER_MESSAGES.BRANCHES,
    url: "/owner/branches",
    icon: BuildingIcon,
  },
  {
    title: OWNER_MESSAGES.DISCIPLINES,
    url: "/owner/disciplines",
    icon: BookOpenIcon,
  },
] as const

type NavigationItem = (typeof navigationItems)[number]

function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return item.url === "/owner"
    ? pathname === item.url
    : pathname.startsWith(item.url)
}

export function OwnerSidebar(props: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/owner" />}
            >
              <EnoedaMark className="size-8 shrink-0 rounded-full" />
              <span className="flex flex-col leading-tight">
                <span className="text-base font-semibold">
                  {OWNER_MESSAGES.SHELL_TITLE}
                </span>
                <span className="text-xs text-sidebar-foreground/70">
                  {OWNER_MESSAGES.CONTROL_PLANE}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-[0.08em]">
            {OWNER_MESSAGES.MANAGEMENT}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = isNavigationItemActive(item, pathname)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      className="[&[data-active]>svg]:text-sidebar-primary"
                      render={<Link href={item.url} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutButton tone="sidebar" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
