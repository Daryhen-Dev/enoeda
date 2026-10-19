"use client"

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { Dispatch, SetStateAction } from "react"

import { useIsMobile } from "@/hooks/use-mobile"

import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from "./constants"
import {
  SIDEBAR_STATES,
  type SidebarController,
  type SidebarStateProviderProps,
} from "./types"

const SidebarStateContext = createContext<SidebarController | null>(null)

/**
 * Tablet range (md–lg): the 288px rail starts collapsed to icons so the
 * header keeps room. Below it the shell is a sheet (isMobile); from lg the
 * user's toggle/cookie owns the state again.
 */
const COMPACT_MEDIA_QUERY = "(min-width: 768px) and (max-width: 1023px)"

export function SidebarStateProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: SidebarStateProviderProps) {
  const isMobile = useIsMobile() ?? false
  const [openInternal, setOpenInternal] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openInternal
  const openRef = useRef(open)
  const preCompactOpenRef = useRef<boolean | null>(null)

  const setOpen: Dispatch<SetStateAction<boolean>> = (value) => {
    const nextOpen = typeof value === "function" ? value(open) : value

    if (!isControlled) {
      setOpenInternal(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const toggleSidebar = () => {
    if (isMobile) {
      setOpenMobile((currentOpen) => !currentOpen)
      return
    }

    setOpen((currentOpen) => !currentOpen)
  }

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
  }, [open])

  // Keep a ref of the live open value so the compact-range effect below can
  // read it without re-running on every toggle.
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    const mql = window.matchMedia(COMPACT_MEDIA_QUERY)
    const onChange = () => {
      setIsCompact(mql.matches)
    }
    mql.addEventListener("change", onChange)
    // Initial measurement — only on mount, safe per exhaustive-deps
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Compact rail design: the compact range only retunes the DEFAULT, it does
  // not force the state. Entering the range collapses the rail once (icon
  // mode), remembering the user's prior choice; leaving it restores that
  // choice so lg+ keeps "respecting the user's toggle/cookie". While compact,
  // the trigger and Ctrl/Meta+B still toggle `open` normally — expanding the
  // rail at tablet widths is allowed and is a plain toggle, not an overlay.
  useEffect(() => {
    if (isCompact) {
      preCompactOpenRef.current ??= openRef.current
      if (openRef.current) {
        setOpen(false)
      }
    } else if (preCompactOpenRef.current !== null) {
      setOpen(preCompactOpenRef.current)
      preCompactOpenRef.current = null
    }
    // Only the compact-range transition may retune the rail; the live open
    // value is read through openRef so toggles never re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        typeof event.key !== "string" ||
        event.key.toLowerCase() !== SIDEBAR_KEYBOARD_SHORTCUT ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return
      }

      event.preventDefault()

      if (isMobile) {
        setOpenMobile((currentOpen) => !currentOpen)
        return
      }

      const nextOpen = !open

      if (!isControlled) {
        setOpenInternal(nextOpen)
      }

      onOpenChange?.(nextOpen)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isControlled, isMobile, onOpenChange, open])

  const contextValue: SidebarController = {
    state: open ? SIDEBAR_STATES.expanded : SIDEBAR_STATES.collapsed,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  }

  return createElement(SidebarStateContext.Provider, { value: contextValue }, children)
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext)

  if (context === null) {
    throw new Error("useSidebarState must be used within a SidebarStateProvider")
  }

  return context
}
