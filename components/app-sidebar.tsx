"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  ShieldIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { LogoutButton } from "@/components/auth/logout-button"
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
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

interface NavigationItem {
  title: string
  url: string
  icon: typeof LayoutDashboardIcon
  available: boolean
  adminOnly?: boolean
  profileOnly?: boolean
  hiddenForTeacherOnly?: boolean
}

const navigationItems: NavigationItem[] = [
  { title: DASHBOARD_SHELL_MESSAGES.OVERVIEW, url: "/dashboard", icon: LayoutDashboardIcon, available: true, hiddenForTeacherOnly: true },
  { title: DASHBOARD_SHELL_MESSAGES.STUDENTS, url: "/dashboard/students", icon: UsersIcon, available: true },
  { title: DASHBOARD_SHELL_MESSAGES.STAFF, url: "/dashboard/staff", icon: ShieldIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true },
  { title: DASHBOARD_SHELL_MESSAGES.CALENDAR, url: "/dashboard/calendar", icon: CalendarDaysIcon, available: true },
  { title: DASHBOARD_SHELL_MESSAGES.PAYMENTS, url: "/dashboard/payments", icon: CreditCardIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true },
  { title: DASHBOARD_SHELL_MESSAGES.PROFILE, url: "/dashboard/profile", icon: UserRoundIcon, available: true, profileOnly: true },
]

function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return item.url === "/dashboard" ? pathname === item.url : pathname.startsWith(item.url)
}

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

export function AppSidebar({
  isAdmin = false,
  canManageProfile = false,
  isTeacherOnly = false,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const visibleItems = navigationItems.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.profileOnly || canManageProfile) &&
      (!item.hiddenForTeacherOnly || !isTeacherOnly)
  )

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
              <span className="text-base font-semibold">Enoeda Dojo</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{DASHBOARD_SHELL_MESSAGES.MANAGEMENT}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon
                const isActive = isNavigationItemActive(item, pathname)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
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
            <LogoutButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
