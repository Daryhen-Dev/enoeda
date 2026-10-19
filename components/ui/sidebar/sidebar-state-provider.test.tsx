// @vitest-environment jsdom

import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarStateProvider, useSidebarState } from "./sidebar-state-provider"

const DESKTOP_VIEWPORT_WIDTH = 1024
const MOBILE_MEDIA_QUERY = "(max-width: 767px)"
const COMPACT_MEDIA_QUERY = "(min-width: 768px) and (max-width: 1023px)"

interface RenderedProvider {
  container: HTMLDivElement
  unmount(): void
}

interface MockedMediaQueryList {
  addEventListener: ReturnType<typeof vi.fn>
  addListener: ReturnType<typeof vi.fn>
  dispatchEvent: ReturnType<typeof vi.fn>
  matches: boolean
  media: string
  onchange: null
  removeEventListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
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

/**
 * Mock that answers per query: the compact md–lg range reports the given
 * match, everything else (including the mobile query) reports false.
 * Returns the created lists so tests can flip the compact match and fire its
 * change listener.
 */
function createCompactAwareMatchMediaFactory(initialCompactMatch: boolean) {
  const createdLists: MockedMediaQueryList[] = []
  let compactMatches = initialCompactMatch
  const factory = vi.fn((query: string): MediaQueryList => {
    const list: MockedMediaQueryList = {
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === COMPACT_MEDIA_QUERY ? compactMatches : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }
    createdLists.push(list)
    return list as unknown as MediaQueryList
  })

  return {
    factory,
    getCompactList() {
      const list = createdLists.find((item) => item.media === COMPACT_MEDIA_QUERY)
      if (!list) throw new Error("compact media query was never created")
      return list
    },
    setCompactMatches(matches: boolean) {
      compactMatches = matches
    },
  }
}

function SidebarStateProbe() {
  const { open, state } = useSidebarState()

  return <output data-sidebar-open={String(open)} data-sidebar-state={state} />
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

function getSidebarState(container: HTMLElement) {
  const probe = container.querySelector<HTMLOutputElement>("[data-sidebar-state]")

  expect(probe).not.toBeNull()
  return probe!.getAttribute("data-sidebar-state")
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

  it("collapses by default while the viewport is compact (md–lg) and restores the prior choice on lg", () => {
    const matchMediaMock = createCompactAwareMatchMediaFactory(true)
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMediaMock.factory,
      writable: true,
    })

    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <SidebarStateProvider defaultOpen={true}>
          <SidebarStateProbe />
        </SidebarStateProvider>,
      )
    })

    // Entering the compact range collapses the expanded default to icon mode.
    expect(getSidebarOpen(container)).toBe("false")
    expect(getSidebarState(container)).toBe("collapsed")

    // While compact the toggle still works normally (icon rail is the default,
    // not a forced state).
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { cancelable: true, ctrlKey: true, key: "b" }),
      )
    })
    expect(getSidebarOpen(container)).toBe("true")
    expect(getSidebarState(container)).toBe("expanded")

    // Leaving the compact range restores the user's pre-compact choice
    // (expanded, before the compact collapse retuned it).
    const compactList = matchMediaMock.getCompactList()
    matchMediaMock.setCompactMatches(false)
    compactList.matches = false
    const changeListener = compactList.addEventListener.mock.calls[0]?.[1] as () => void

    act(() => {
      changeListener()
    })

    expect(getSidebarOpen(container)).toBe("true")
    expect(getSidebarState(container)).toBe("expanded")

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("keeps a collapsed choice collapsed after visiting the compact range", () => {
    const matchMediaMock = createCompactAwareMatchMediaFactory(false)
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMediaMock.factory,
      writable: true,
    })

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

    expect(getSidebarOpen(container)).toBe("false")

    const compactList = matchMediaMock.getCompactList()
    matchMediaMock.setCompactMatches(true)
    compactList.matches = true
    let changeListener = compactList.addEventListener.mock.calls[0]?.[1] as () => void

    act(() => {
      changeListener()
    })
    expect(getSidebarOpen(container)).toBe("false")

    matchMediaMock.setCompactMatches(false)
    compactList.matches = false
    changeListener = compactList.addEventListener.mock.calls[0]?.[1] as () => void

    act(() => {
      changeListener()
    })
    // The user had chosen collapsed before the compact range; it stays so.
    expect(getSidebarOpen(container)).toBe("false")

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
