// @vitest-environment jsdom

/**
 * MarketingKarate — the karate page that the home "ENTRENAR KARATE" button opens
 * (S1/S2 of odd/tasks/karate-page.md).
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MARKETING_WHATSAPP_KARATE_URL } from "@/components/marketing/shared/contact"

import {
  KARATE_GALLERY,
  KARATE_PILLARS,
  KARATE_VIDEO,
} from "./karate-content"
import { MarketingKarate } from "./karate"

type ImageProps = ComponentProps<"img"> & { src: string | { src: string } }
type LinkProps = ComponentProps<"a"> & { href: string }

interface RenderedKarate {
  container: HTMLElement
  unmount(): void
}

vi.mock("next/image", () => ({
  // Plain <img> on purpose: the stub keeps `alt` and `src` queryable so the
  // photo labels and the media paths can both be asserted.
  default: ({ alt, className, src }: ImageProps) => {
    const resolvedSrc = typeof src === "string" ? src : src.src

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={className} data-image-src={resolvedSrc} src={resolvedSrc} />
    )
  },
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: LinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function renderKarate(): RenderedKarate {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<MarketingKarate />)
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

function linkByText(container: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(container.querySelectorAll("a")).find(
    (candidate) => candidate.textContent?.trim() === text,
  )

  if (!link) throw new Error(`no anchor: ${text}`)

  return link
}

describe("MarketingKarate", () => {
  let renderedKarate: RenderedKarate | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    renderedKarate?.unmount()
    renderedKarate = undefined
  })

  it("renders a single h1 with the three-word karate cry", () => {
    renderedKarate = renderKarate()
    const headings = renderedKarate.container.querySelectorAll("h1")

    expect(headings).toHaveLength(1)

    const heroText = headings[0].textContent ?? ""
    expect(heroText).toContain("LINAJE.")
    expect(heroText).toContain("TÉCNICA.")
    expect(heroText).toContain("CARÁCTER.")
  })

  it("renders the street demonstration video with poster and controls but no autoplay", () => {
    renderedKarate = renderKarate()
    const video = renderedKarate.container.querySelector("video")

    expect(video).not.toBeNull()
    expect(video!.getAttribute("poster")).toBe(KARATE_VIDEO.poster)
    expect(video!.hasAttribute("controls")).toBe(true)
    expect(video!.hasAttribute("playsinline")).toBe(true)
    expect(video!.hasAttribute("autoplay")).toBe(false)

    const source = video!.querySelector("source")
    expect(source?.getAttribute("src")).toBe(KARATE_VIDEO.src)
    expect(source?.getAttribute("type")).toBe("video/mp4")
  })

  it("points the hero demonstration link at the section holding the video", () => {
    renderedKarate = renderKarate()
    const demonstrationLink = linkByText(renderedKarate.container, "VER LA DEMOSTRACIÓN")

    expect(demonstrationLink.getAttribute("href")).toBe("#calle")
    expect(renderedKarate.container.querySelector("#calle video")).not.toBeNull()
  })

  it("renders one card per pillar", () => {
    renderedKarate = renderKarate()
    const pillarsSection = renderedKarate.container.querySelector("#pilares")

    expect(pillarsSection).not.toBeNull()
    expect(pillarsSection!.querySelectorAll("article")).toHaveLength(KARATE_PILLARS.length)

    KARATE_PILLARS.forEach((pillar) => {
      expect(pillarsSection!.textContent).toContain(pillar.name)
    })
  })

  it("renders every gallery photo with an accessible label", () => {
    renderedKarate = renderKarate()
    const images = Array.from(renderedKarate.container.querySelectorAll("img"))

    expect(images.length).toBeGreaterThanOrEqual(KARATE_GALLERY.length)
    images.forEach((image) => {
      expect((image.getAttribute("alt") ?? "").trim().length).toBeGreaterThan(0)
    })
  })

  it("keeps a single WhatsApp call to action, on the hero, with the karate message", () => {
    renderedKarate = renderKarate()
    const whatsappLinks = Array.from(renderedKarate.container.querySelectorAll("a")).filter(
      (link) => (link.getAttribute("href") ?? "").startsWith("https://wa.me/"),
    )

    expect(whatsappLinks).toHaveLength(1)
    expect(whatsappLinks[0].getAttribute("href")).toBe(MARKETING_WHATSAPP_KARATE_URL)
    expect(whatsappLinks[0].textContent).toBe("QUIERO ENTRENAR")
  })

  it("closes on the sedes list instead of repeating the footer WhatsApp", () => {
    renderedKarate = renderKarate()
    const band = renderedKarate.container.querySelector("#karate-cierre-heading")!.closest("section")!
    const bandWhatsApp = Array.from(band.querySelectorAll("a")).filter((link) =>
      (link.getAttribute("href") ?? "").startsWith("https://wa.me/"),
    )

    expect(bandWhatsApp).toHaveLength(0)
    expect((band.textContent ?? "").toUpperCase()).not.toContain("WHATSAPP")
    expect(linkByText(band, "VER SEDES Y HORARIOS").getAttribute("href")).toBe("/#sedes")
  })

  it("uses only karate media, never the kickboxing page assets", () => {
    renderedKarate = renderKarate()
    const media = Array.from(renderedKarate.container.querySelectorAll("img"))
      .map((image) => image.getAttribute("src") ?? "")
      .concat(Array.from(renderedKarate.container.querySelectorAll("video")).map((video) => video.getAttribute("poster") ?? ""))

    expect(media.length).toBeGreaterThan(0)
    media.forEach((path) => {
      expect(path).not.toContain("kickboxing")
    })
  })
})