"use client"

import { Suspense, type ComponentProps } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  AwardIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  CreditCardIcon,
  GavelIcon,
  LayoutDashboardIcon,
  ShieldIcon,
  UserRoundIcon,
  UsersIcon,
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
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

export interface NavigationItem {
  title: string
  url: string
  icon: typeof LayoutDashboardIcon
  available: boolean
  adminOnly?: boolean
  profileOnly?: boolean
  hiddenForTeacherOnly?: boolean
  branchScoped: boolean
}

export const navigationItems: NavigationItem[] = [
  { title: DASHBOARD_SHELL_MESSAGES.OVERVIEW, url: "/dashboard", icon: LayoutDashboardIcon, available: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.STUDENTS, url: "/dashboard/students", icon: UsersIcon, available: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.CONDUCT, url: "/dashboard/conduct", icon: GavelIcon, available: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.STAFF, url: "/dashboard/staff", icon: ShieldIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.CALENDAR, url: "/dashboard/calendar", icon: CalendarDaysIcon, available: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.CLASS_SCHEDULES, url: "/dashboard/schedule", icon: CalendarRangeIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.BELTS, url: "/dashboard/belts", icon: AwardIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.PAYMENTS, url: "/dashboard/payments", icon: CreditCardIcon, available: true, adminOnly: true, hiddenForTeacherOnly: true, branchScoped: true },
  { title: DASHBOARD_SHELL_MESSAGES.PROFILE, url: "/dashboard/profile", icon: UserRoundIcon, available: true, profileOnly: true, branchScoped: false },
]

interface NavigationVisibilityFlags {
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

/**
 * Visibility filter shared by the sidebar render and its tests: admin-only
 * and profile-only items are flagged per item; teacher-only users lose the
 * items marked hiddenForTeacherOnly (admins and teachers keep the rest).
 */
export function getVisibleNavigationItems(
  flags: NavigationVisibilityFlags
): NavigationItem[] {
  return navigationItems.filter(
    (item) =>
      (!item.adminOnly || flags.isAdmin) &&
      (!item.profileOnly || flags.canManageProfile) &&
      (!item.hiddenForTeacherOnly || !flags.isTeacherOnly)
  )
}

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
  const visibleItems = getVisibleNavigationItems({
    isAdmin,
    canManageProfile,
    isTeacherOnly,
  })
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
              className="data-[slot=sidebar-menu-button]:p-1.5! data-[slot=sidebar-menu-button]:group-data-[collapsible=icon]:p-0!"
              render={
                <Link href={buildNavigationHref("/dashboard", true, branchId)} />
              }
            >
              <EnoedaMark className="size-8 shrink-0 rounded-full" />
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                Enoeda Dojo
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-[0.08em]">
            {DASHBOARD_SHELL_MESSAGES.MANAGEMENT}
          </SidebarGroupLabel>
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
                      className="[&[data-active]>svg]:text-sidebar-primary"
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
    <Sidebar collapsible="icon" {...props}>
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
            {/* Icon mode drops the label button; expand the rail to log out. */}
            <div className="group-data-[collapsible=icon]:hidden">
              <LogoutButton tone="sidebar" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
