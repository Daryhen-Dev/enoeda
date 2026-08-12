"use client"

import {
  createContext,
  createElement,
  useContext,
  useEffect,
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

export function SidebarStateProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: SidebarStateProviderProps) {
  const isMobile = useIsMobile() ?? false
  const [openInternal, setOpenInternal] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openInternal

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
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
