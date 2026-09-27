// @vitest-environment jsdom

import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarStateProvider, useSidebarState } from "./sidebar-state-provider"

const DESKTOP_VIEWPORT_WIDTH = 1024
const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

interface RenderedProvider {
  container: HTMLDivElement
  unmount(): void
}

function createMatchMediaMock(): MediaQueryList {
  return {
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: MOBILE_MEDIA_QUERY,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as MediaQueryList
}

function SidebarStateProbe() {
  const { open } = useSidebarState()

  return <output data-sidebar-open={String(open)} />
}

function renderProvider(): RenderedProvider {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <SidebarStateProvider defaultOpen={false}>
        <SidebarStateProbe />
      </SidebarStateProvider>,
    )
  })

  return {
    container,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function getSidebarOpen(container: HTMLElement) {
  const probe = container.querySelector<HTMLOutputElement>("[data-sidebar-open]")

  expect(probe).not.toBeNull()
  return probe!.getAttribute("data-sidebar-open")
}

describe("SidebarStateProvider keyboard shortcut", () => {
  let renderedProvider: RenderedProvider | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: DESKTOP_VIEWPORT_WIDTH,
      writable: true,
    })
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => createMatchMediaMock()),
      writable: true,
    })
  })

  afterEach(() => {
    renderedProvider?.unmount()
    renderedProvider = undefined
    vi.restoreAllMocks()
  })

  it("ignores malformed keydown events and preserves Ctrl/Meta+B shortcuts", () => {
    renderedProvider = renderProvider()
    const { container } = renderedProvider
    const malformedEvent = new Event("keydown", { cancelable: true })

    expect(() => {
      act(() => {
        window.dispatchEvent(malformedEvent)
      })
    }).not.toThrow()
    expect(malformedEvent.defaultPrevented).toBe(false)
    expect(getSidebarOpen(container)).toBe("false")

    const ctrlShortcut = new KeyboardEvent("keydown", {
      cancelable: true,
      ctrlKey: true,
      key: "B",
    })

    act(() => {
      window.dispatchEvent(ctrlShortcut)
    })

    expect(ctrlShortcut.defaultPrevented).toBe(true)
    expect(getSidebarOpen(container)).toBe("true")

    const metaShortcut = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "b",
      metaKey: true,
    })

    act(() => {
      window.dispatchEvent(metaShortcut)
    })

    expect(metaShortcut.defaultPrevented).toBe(true)
    expect(getSidebarOpen(container)).toBe("false")
  })

  it("removes the global keydown listener when unmounted", () => {
    renderedProvider = renderProvider()
    const { unmount } = renderedProvider

    unmount()
    renderedProvider = undefined

    const shortcut = new KeyboardEvent("keydown", {
      cancelable: true,
      ctrlKey: true,
      key: "b",
    })

    act(() => {
      window.dispatchEvent(shortcut)
    })

    expect(shortcut.defaultPrevented).toBe(false)
  })
})
