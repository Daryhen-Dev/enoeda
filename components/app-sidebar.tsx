"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BuildingIcon,
  LayoutDashboardIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navigationItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
    available: true,
  },
  {
    title: "Branches",
    url: "/dashboard/branches",
    icon: BuildingIcon,
    available: false,
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: UsersIcon,
    available: true,
  },
] as const

type NavigationItem = (typeof navigationItems)[number]

function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return item.url === "/dashboard"
    ? pathname === item.url
    : pathname.startsWith(item.url)
}

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <ShieldIcon className="size-5!" />
              <span className="text-base font-semibold">Enoeda Academy</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = isNavigationItemActive(item, pathname)

                return (
                  <SidebarMenuItem key={item.title}>
                    {item.available ? (
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.url} />}
                      >
                        <Icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        aria-disabled="true"
                        className="cursor-not-allowed opacity-60"
                        disabled
                        isActive={isActive}
                        tooltip={`${item.title} — Soon`}
                      >
                        <Icon />
                        <span>{item.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Soon
                        </span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
