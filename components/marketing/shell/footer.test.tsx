// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MARKETING_COLLABORATORS,
  MARKETING_COLLABORATORS_INTRO,
} from "@/components/marketing/shared/collaborators"

import { MarketingFooter } from "./footer"

type ImageProps = ComponentProps<"img"> & { src: string }

interface RenderedFooter {
  container: HTMLElement
  unmount(): void
}

vi.mock("next/image", () => ({
  // Plain <img> on purpose: the stub must keep `alt` queryable so the
  // collaborator labels are asserted. next/image is optimised away in tests.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, className, src }: ImageProps) => (
    <img alt={alt} className={className} data-image-src={src} src={src} />
  ),
}))

function renderFooter(): RenderedFooter {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<MarketingFooter />)
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

function getCollaboratorsRegion(container: HTMLElement) {
  const region = container.querySelector<HTMLElement>(
    'section[aria-labelledby="footer-colaboradores-heading"]',
  )

  expect(region).not.toBeNull()
  return region!
}

describe("MarketingFooter collaborators", () => {
  let renderedFooter: RenderedFooter | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    renderedFooter?.unmount()
    renderedFooter = undefined
  })

  it("renders every collaborator logo with an accessible label", () => {
    renderedFooter = renderFooter()
    const images = Array.from(
      getCollaboratorsRegion(renderedFooter.container).querySelectorAll("img"),
    )

    expect(images).toHaveLength(MARKETING_COLLABORATORS.length)
    expect(images.map((image) => image.getAttribute("alt"))).toEqual(
      MARKETING_COLLABORATORS.map((collaborator) => collaborator.alt),
    )
  })

  it("labels the block with a real heading and a single intro line", () => {
    renderedFooter = renderFooter()
    const region = getCollaboratorsRegion(renderedFooter.container)
    const heading = region.querySelector("h2")

    expect(heading?.id).toBe("footer-colaboradores-heading")
    expect(heading?.textContent).toBe("CON EL RESPALDO DE")
    expect(region.textContent).toContain(MARKETING_COLLABORATORS_INTRO)
  })

  it("keeps each entry to one role line instead of repeating the wordmark already drawn in the logo", () => {
    renderedFooter = renderFooter()
    const items = Array.from(
      getCollaboratorsRegion(renderedFooter.container).querySelectorAll("li"),
    )

    expect(items).toHaveLength(MARKETING_COLLABORATORS.length)

    items.forEach((item, index) => {
      const collaborator = MARKETING_COLLABORATORS[index]
      const visibleText = item.textContent ?? ""

      expect(visibleText.trim()).toBe(collaborator.role)
      expect(visibleText).not.toContain(collaborator.name)
    })
  })
})
