"use client"

import { createContext, useContext } from "react"
import type { ReactNode } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { useSidebarState } from "./sidebar-state-provider"
import {
  SIDEBAR_COLLAPSIBLES,
  SIDEBAR_SIDES,
  SIDEBAR_VARIANTS,
  type SidebarProps,
  type SidebarStyle,
} from "./types"

const SidebarStyleContext = createContext<SidebarStyle | null>(null)

interface SidebarStyleProviderProps {
  children: ReactNode
  style: SidebarStyle
}

export function SidebarStyleProvider({
  children,
  style,
}: SidebarStyleProviderProps) {
  return (
    <SidebarStyleContext value={style}>{children}</SidebarStyleContext>
  )
}

function useSidebarStyle() {
  return useContext(SidebarStyleContext)
}

function composeSidebarStyle(
  providerStyle: SidebarStyle | null,
  style?: SidebarStyle
): SidebarStyle | undefined {
  if (providerStyle === null && style === undefined) {
    return undefined
  }

  return {
    ...providerStyle,
    ...style,
  }
}

export function Sidebar({
  className,
  children,
  side = SIDEBAR_SIDES.left,
  variant = SIDEBAR_VARIANTS.sidebar,
  collapsible = SIDEBAR_COLLAPSIBLES.offcanvas,
  style,
  dir,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebarState()
  const sidebarStyle = composeSidebarStyle(useSidebarStyle(), style)

  if (collapsible === SIDEBAR_COLLAPSIBLES.none) {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        style={sidebarStyle}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={sidebarStyle}
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={
        state === "collapsed" ? collapsible : ""
      }
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
      style={sidebarStyle}
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === SIDEBAR_VARIANTS.floating ||
            variant === SIDEBAR_VARIANTS.inset
            ? "group-data-[collapsible=icon]:w-(--sidebar-width-icon-floating)"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:-left-(--sidebar-width) data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:-right-(--sidebar-width) md:flex",
          variant === SIDEBAR_VARIANTS.floating ||
            variant === SIDEBAR_VARIANTS.inset
            ? "p-2 group-data-[collapsible=icon]:w-(--sidebar-width-icon-floating-with-border)"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
