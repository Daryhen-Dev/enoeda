// @vitest-environment jsdom

import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AUTH_MESSAGES } from "@/lib/localization/es-ec"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

import { LogoutButton } from "./logout-button"

describe("LogoutButton", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.append(container)
  })

  afterEach(() => {
    container.remove()
  })

  function render(element: React.ReactElement) {
    const root = createRoot(container)
    act(() => root.render(element))
    return root
  }

  it("renders the sidebar tone in sidebar ink colors so it stays legible on the ink rail", () => {
    const root = render(<LogoutButton tone="sidebar" />)
    const button = container.querySelector("button")

    expect(button?.textContent).toBe(AUTH_MESSAGES.LOGOUT_ACTION)
    expect(button?.className).toContain("text-sidebar-foreground")
    expect(button?.className).not.toContain("bg-background")
    act(() => root.unmount())
  })

  it("keeps the default outline button on paper surfaces", () => {
    const root = render(<LogoutButton />)
    const button = container.querySelector("button")

    expect(button?.className).toContain("bg-background")
    expect(button?.className).not.toContain("text-sidebar-foreground")
    act(() => root.unmount())
  })
})
