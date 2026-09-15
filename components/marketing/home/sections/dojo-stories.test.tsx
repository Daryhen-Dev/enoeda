// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarketingDojoStories } from "./dojo-stories"

type ImageProps = ComponentProps<"img"> & { src: string }

interface RenderedStories {
  container: HTMLDivElement
  unmount(): void
}

vi.mock("next/image", () => ({
  default: ({ className, src }: ImageProps) => (
    <span aria-hidden className={className} data-image-src={src} />
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: ComponentProps<"div">) => <div>{children}</div>,
  DialogContent: ({ children }: ComponentProps<"div">) => <div>{children}</div>,
  DialogDescription: ({ children }: ComponentProps<"div">) => <div>{children}</div>,
  DialogTitle: ({ children }: ComponentProps<"div">) => <h2>{children}</h2>,
}))

function renderStories(): RenderedStories {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<MarketingDojoStories />)
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

function getOpenStoryButton(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Abrir historia: La práctica empieza aquí"]',
  )

  expect(button).not.toBeNull()
  return button!
}

describe("MarketingDojoStories playback", () => {
  let renderedStories: RenderedStories | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
  })

  afterEach(() => {
    renderedStories?.unmount()
    renderedStories = undefined
    vi.restoreAllMocks()
  })

  it("renders all seven stories in one rail without pagination controls", () => {
    const stories = renderStories()
    renderedStories = stories

    expect(
      stories.container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Abrir historia:"]',
      ),
    ).toHaveLength(7)
    expect(stories.container.textContent).not.toContain("Página")
    expect(
      stories.container.querySelector('button[aria-label="Ver historias anteriores"]'),
    ).toBeNull()
    expect(
      stories.container.querySelector('button[aria-label="Ver más historias"]'),
    ).toBeNull()
  })

  it("attempts the initial audible playback before the opening click finishes", async () => {
    let isOpeningGestureActive = true
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
      expect(isOpeningGestureActive).toBe(true)
      return Promise.resolve()
    })

    const stories = renderStories()
    renderedStories = stories

    await act(async () => {
      getOpenStoryButton(stories.container).click()
      isOpeningGestureActive = false
      await Promise.resolve()
    })

    const video = stories.container.querySelector<HTMLVideoElement>("video")

    expect(play).toHaveBeenCalledOnce()
    expect(video?.muted).toBe(false)
    expect(video?.volume).toBe(1)
  })

  it("keeps an actionable audible-playback fallback when the browser rejects playback", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"))
      .mockResolvedValue(undefined)

    const stories = renderStories()
    renderedStories = stories

    await act(async () => {
      getOpenStoryButton(stories.container).click()
      await Promise.resolve()
    })

    const fallback = Array.from(stories.container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Reproducir con sonido"),
    )

    expect(fallback).toBeDefined()

    await act(async () => {
      fallback?.click()
      await Promise.resolve()
    })

    expect(play).toHaveBeenCalledTimes(2)
  })
})
