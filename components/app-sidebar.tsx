"use client"

import { Suspense, type ComponentProps } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
  branchScoped: boolean
}

const navigationItems: NavigationItem[] = [
  { title: DASHBOARD_SHELL_MESSAGES.OVERVIEW, url: "/dashboard", icon: LayoutDashboardIcon, available: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.STUDENTS, url: "/dashboard/students", icon: UsersIcon, available: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.STAFF, url: "/dashboard/staff", icon: ShieldIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.CALENDAR, url: "/dashboard/calendar", icon: CalendarDaysIcon, available: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.PAYMENTS, url: "/dashboard/payments", icon: CreditCardIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.PROFILE, url: "/dashboard/profile", icon: UserRoundIcon, available: true, profileOnly: true, branchScoped: false },
]

function matchesNavigationItem(
  item: Pick<NavigationItem, "url">,
  pathname: string
) {
  return item.url === "/dashboard" ? pathname === item.url : pathname.startsWith(item.url)
}

export function getActiveNavigationItemUrl(
  items: readonly Pick<NavigationItem, "url">[],
  pathname: string
): string | null {
  return items
    .filter((item) => matchesNavigationItem(item, pathname))
    .reduce<string | null>(
      (activeUrl, item) =>
        activeUrl === null || item.url.length > activeUrl.length
          ? item.url
          : activeUrl,
      null
    )
}

export function buildNavigationHref(
  url: string,
  branchScoped: boolean,
  branchId: string | null
): string {
  if (!branchScoped || !branchId) return url
  // branchId comes from the URL, so encode it: an unencoded value could inject
  // extra query pairs into the href.
  return `${url}${url.includes("?") ? "&" : "?"}branch=${encodeURIComponent(
    branchId
  )}`
}

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

function SidebarNavigation({
  isAdmin,
  canManageProfile,
  isTeacherOnly,
}: Pick<AppSidebarProps, "isAdmin" | "canManageProfile" | "isTeacherOnly">) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const branchId = searchParams.get("branch")
  const visibleItems = navigationItems.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.profileOnly || canManageProfile) &&
      (!item.hiddenForTeacherOnly || !isTeacherOnly)
  )
  const activeNavigationItemUrl = getActiveNavigationItemUrl(
    visibleItems,
    pathname
  )

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={
                <Link href={buildNavigationHref("/dashboard", true, branchId)} />
              }
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
                const isActive = item.url === activeNavigationItemUrl
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={
                        <Link
                          href={buildNavigationHref(
                            item.url,
                            item.branchScoped,
                            branchId
                          )}
                        />
                      }
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
    </>
  )
}

export function AppSidebar({
  isAdmin = false,
  canManageProfile = false,
  isTeacherOnly = false,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <Suspense fallback={null}>
        <SidebarNavigation
          isAdmin={isAdmin}
          canManageProfile={canManageProfile}
          isTeacherOnly={isTeacherOnly}
        />
      </Suspense>
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
