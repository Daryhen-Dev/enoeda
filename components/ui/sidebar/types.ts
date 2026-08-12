import type {
  ComponentProps,
  CSSProperties,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react"

export const SIDEBAR_STATES = {
  expanded: "expanded",
  collapsed: "collapsed",
} as const

export const SIDEBAR_SIDES = {
  left: "left",
  right: "right",
} as const

export const SIDEBAR_VARIANTS = {
  sidebar: "sidebar",
  floating: "floating",
  inset: "inset",
} as const

export const SIDEBAR_COLLAPSIBLES = {
  offcanvas: "offcanvas",
  icon: "icon",
  none: "none",
} as const

export type SidebarState = (typeof SIDEBAR_STATES)[keyof typeof SIDEBAR_STATES]
export type SidebarSide = (typeof SIDEBAR_SIDES)[keyof typeof SIDEBAR_SIDES]
export type SidebarVariant =
  (typeof SIDEBAR_VARIANTS)[keyof typeof SIDEBAR_VARIANTS]
export type SidebarCollapsible =
  (typeof SIDEBAR_COLLAPSIBLES)[keyof typeof SIDEBAR_COLLAPSIBLES]

export interface SidebarStyle extends CSSProperties {
  "--sidebar-width"?: string
  "--sidebar-width-icon"?: string
  "--sidebar-width-icon-floating"?: string
  "--sidebar-width-icon-floating-with-border"?: string
}

export interface SidebarProps extends Omit<ComponentProps<"div">, "style"> {
  style?: SidebarStyle
  side?: SidebarSide
  variant?: SidebarVariant
  collapsible?: SidebarCollapsible
}

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