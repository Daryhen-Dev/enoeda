// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarketingHeader } from "./header"

const MOBILE_MENU_ID = "marketing-mobile-menu"
const DESKTOP_MEDIA_QUERY = "(min-width: 48rem)"

type LinkProps = ComponentProps<"a"> & { href: string }
type ImageProps = ComponentProps<"img">

interface MatchMediaMock {
  mediaQuery: MediaQueryList
  setMatches(matches: boolean): void
}

interface RenderedHeader {
  container: HTMLDivElement
  unmount(): void
}

vi.mock("next/image", () => ({
  default: ({ className }: ImageProps) => <span aria-hidden className={className} />,
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: LinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function createMatchMediaMock(initialMatches = false): MatchMediaMock {
  let matches = initialMatches
  const changeListeners = new Set<(event: MediaQueryListEvent) => void>()

  const mediaQuery = {
    get matches() {
      return matches
    },
    media: DESKTOP_MEDIA_QUERY,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === "change" && typeof listener === "function") {
          changeListeners.add(listener as (event: MediaQueryListEvent) => void)
        }
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === "change" && typeof listener === "function") {
          changeListeners.delete(listener as (event: MediaQueryListEvent) => void)
        }
      },
    ),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  return {
    mediaQuery,
    setMatches(nextMatches) {
      matches = nextMatches
      changeListeners.forEach((listener) =>
        listener({ matches, media: DESKTOP_MEDIA_QUERY } as MediaQueryListEvent),
      )
    },
  }
}

function renderHeader(): RenderedHeader {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<MarketingHeader />)
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

function getMenuTrigger(container: HTMLElement) {
  const trigger = container.querySelector<HTMLButtonElement>(
    `button[aria-controls="${MOBILE_MENU_ID}"]`,
  )

  expect(trigger).not.toBeNull()
  return trigger!
}

function getHeaderBrand(container: HTMLElement) {
  const brand = container.querySelector<HTMLAnchorElement>(
    'header > div > a[aria-label="Ir al inicio de ENOEDA Dojo"]',
  )

  expect(brand).not.toBeNull()
  return brand!
}

function openMenu(container: HTMLElement) {
  act(() => {
    getMenuTrigger(container).click()
  })
}

describe("MarketingHeader mobile menu", () => {
  let renderedHeader: RenderedHeader | undefined
  let matchMediaMock: MatchMediaMock

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    matchMediaMock = createMatchMediaMock()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => matchMediaMock.mediaQuery),
      writable: true,
    })
  })

  afterEach(() => {
    renderedHeader?.unmount()
    renderedHeader = undefined
    vi.restoreAllMocks()
  })

  it("starts closed, updates aria-expanded, and focuses the first destination when opened", () => {
    renderedHeader = renderHeader()
    const { container } = renderedHeader
    const trigger = getMenuTrigger(container)

    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(container.querySelector(`#${MOBILE_MENU_ID}`)).toBeNull()

    openMenu(container)

    const firstDestination = container.querySelector<HTMLAnchorElement>(
      '#marketing-mobile-menu nav[aria-label="Destinos de la navegación móvil"] a',
    )

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(firstDestination).not.toBeNull()
    expect(document.activeElement).toBe(firstDestination)
  })

  it("closes on Escape and restores focus to the mobile trigger", () => {
    renderedHeader = renderHeader()
    const { container } = renderedHeader
    const trigger = getMenuTrigger(container)

    openMenu(container)

    act(() => {
      container
        .querySelector<HTMLElement>(`#${MOBILE_MENU_ID}`)
        ?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
    })

    expect(container.querySelector(`#${MOBILE_MENU_ID}`)).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("closes from its close button and restores focus to the mobile trigger", () => {
    renderedHeader = renderHeader()
    const { container } = renderedHeader
    const trigger = getMenuTrigger(container)

    openMenu(container)

    act(() => {
      container
        .querySelector<HTMLButtonElement>(`#${MOBILE_MENU_ID} button[aria-label="Cerrar navegación"]`)
        ?.click()
    })

    expect(container.querySelector(`#${MOBILE_MENU_ID}`)).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("closes immediately when the desktop breakpoint already matches and focuses the header brand", () => {
    matchMediaMock = createMatchMediaMock(true)
    window.matchMedia = vi.fn(() => matchMediaMock.mediaQuery)
    renderedHeader = renderHeader()
    const { container } = renderedHeader
    const headerBrand = getHeaderBrand(container)

    openMenu(container)

    expect(container.querySelector(`#${MOBILE_MENU_ID}`)).toBeNull()
    expect(document.activeElement).toBe(headerBrand)
  })

  it("closes on a desktop breakpoint change, focuses the header brand, and cleans up the listener", () => {
    renderedHeader = renderHeader()
    const { container } = renderedHeader
    const headerBrand = getHeaderBrand(container)

    openMenu(container)

    expect(matchMediaMock.mediaQuery.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )

    act(() => {
      matchMediaMock.setMatches(true)
    })

    expect(container.querySelector(`#${MOBILE_MENU_ID}`)).toBeNull()
    expect(document.activeElement).toBe(headerBrand)
    expect(matchMediaMock.mediaQuery.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )
  })
})
