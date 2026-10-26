"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import {
  buildNavigationHref,
  getActiveNavigationItemUrl,
  getVisibleNavigationItems,
  navigationItems,
  type NavigationItem,
} from "@/components/app-sidebar"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

/**
 * The teacher's daily loop, in the order they walk it: open today's classes,
 * check the calendar, register a fine, look a student up. Everything else stays
 * in the sidebar sheet.
 */
export const MOBILE_PRIMARY_URLS = [
  "/dashboard",
  "/dashboard/calendar",
  "/dashboard/conduct",
  "/dashboard/students",
] as const

interface MobilePrimaryFlags {
  isAdmin?: boolean
  canManageProfile?: boolean
  isTeacherOnly?: boolean
}

/**
 * Curated subset of the sidebar navigation for the bottom bar. Filters through
 * the same visibility rules, so an admin-only or profile-only entry can never
 * be promoted into the bar by accident.
 */
export function getMobilePrimaryItems(
  items: NavigationItem[],
  flags: MobilePrimaryFlags
): NavigationItem[] {
  const visible = getVisibleNavigationItems(flags)
  const available = items.filter((item) => visible.includes(item))

  return MOBILE_PRIMARY_URLS.flatMap(
    (url) => available.filter((item) => item.url === url)
  )
}

/**
 * Bottom navigation for phones (below `md`), where the sidebar is a sheet. The
 * bar keeps four taps in the thumb zone instead of a hamburger plus a list, and
 * carries the active branch so switching sections never changes sucursal.
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const branchId = searchParams.get("branch")
  const items = getMobilePrimaryItems(navigationItems, {
    canManageProfile: true,
    isAdmin: true,
  })
  const activeUrl = getActiveNavigationItemUrl(
    items.map((item) => ({ url: item.url })),
    pathname
  )

  return (
    <nav
      aria-label={DASHBOARD_SHELL_MESSAGES.MOBILE_NAV_LABEL}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item, index) => {
        const Icon = item.icon
        const isActive = item.url === activeUrl

        return (
          <Link
            key={item.url}
            href={buildNavigationHref(item.url, item.branchScoped, branchId)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              index > 0 && "border-l border-border/60",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon
              className={cn("size-5", isActive && "text-seal")}
              aria-hidden="true"
            />
            <span className="truncate">{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
