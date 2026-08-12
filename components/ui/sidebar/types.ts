import type { Dispatch, ReactNode, SetStateAction } from "react"

export const SIDEBAR_STATES = {
  expanded: "expanded",
  collapsed: "collapsed",
} as const

export type SidebarState = (typeof SIDEBAR_STATES)[keyof typeof SIDEBAR_STATES]

export interface SidebarController {
  state: SidebarState
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  openMobile: boolean
  setOpenMobile: Dispatch<SetStateAction<boolean>>
  isMobile: boolean
  toggleSidebar: () => void
}

export interface SidebarStateProviderProps {
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}
