// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getMarketingWhatsAppUrl } from "@/components/marketing/shared/contact"

import {
  KICKBOXING_GALLERY,
  KICKBOXING_STYLES,
  KICKBOXING_WHATSAPP_MESSAGE,
} from "./kickboxing-content"
import { MarketingKickboxing } from "./kickboxing"

type ImageProps = ComponentProps<"img"> & { src: string | { src: string } }
type LinkProps = ComponentProps<"a"> & { href: string }

interface RenderedKickboxing {
  container: HTMLElement
  unmount(): void
}

vi.mock("next/image", () => ({
  // Plain <img> on purpose: the stub must keep `alt` queryable so every
  // photo label can be asserted. next/image is optimised away in tests.
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

function renderKickboxing(): RenderedKickboxing {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<MarketingKickboxing />)
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

describe("MarketingKickboxing", () => {
  let renderedKickboxing: RenderedKickboxing | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    renderedKickboxing?.unmount()
    renderedKickboxing = undefined
  })

  it("renders a single h1 with the three-word battle cry", () => {
    renderedKickboxing = renderKickboxing()
    const headings = renderedKickboxing.container.querySelectorAll("h1")

    expect(headings).toHaveLength(1)

    const heroText = headings[0].textContent ?? ""
    expect(heroText).toContain("PUÑOS.")
    expect(heroText).toContain("PIERNAS.")
    expect(heroText).toContain("INSTINTO.")
  })

  it("renders the training video with poster and controls but no autoplay", () => {
    renderedKickboxing = renderKickboxing()
    const video = renderedKickboxing.container.querySelector("video")

    expect(video).not.toBeNull()
    expect(video!.getAttribute("poster")).toBe("/media/kickboxing/entrenamiento.webp")
    expect(video!.hasAttribute("controls")).toBe(true)
    expect(video!.hasAttribute("playsinline")).toBe(true)
    expect(video!.hasAttribute("autoplay")).toBe(false)

    const source = video!.querySelector("source")
    expect(source?.getAttribute("src")).toBe("/media/kickboxing/entrenamiento.mp4")
    expect(source?.getAttribute("type")).toBe("video/mp4")
  })

  it("omits the origin timeline and the Dutch-school quote band", () => {
    renderedKickboxing = renderKickboxing()
    const pageText = renderedKickboxing.container.textContent ?? ""

    expect(renderedKickboxing.container.querySelector("#origen")).toBeNull()
    expect(renderedKickboxing.container.querySelector("blockquote")).toBeNull()
    expect(pageText).not.toContain("EL ORIGEN")
    expect(pageText).not.toContain("SI RECONOCES DE DÓNDE VIENE UN PELEADOR")
  })

  it("points the hero history link at the training video section", () => {
    renderedKickboxing = renderKickboxing()
    const historyLink = Array.from(renderedKickboxing.container.querySelectorAll("a")).find(
      (link) => link.textContent === "VER LA HISTORIA",
    )

    expect(historyLink?.getAttribute("href")).toBe("#historia")
    expect(renderedKickboxing.container.querySelector("#historia video")).not.toBeNull()
  })

  it("renders one card per kickboxing style", () => {
    renderedKickboxing = renderKickboxing()
    const estilosSection = renderedKickboxing.container.querySelector("#estilos")

    expect(estilosSection).not.toBeNull()
    expect(estilosSection!.querySelectorAll("article")).toHaveLength(KICKBOXING_STYLES.length)

    KICKBOXING_STYLES.forEach((style) => {
      expect(estilosSection!.textContent).toContain(style.name)
    })
  })

  it("renders every photo of the gallery with an accessible label", () => {
    renderedKickboxing = renderKickboxing()
    const images = Array.from(renderedKickboxing.container.querySelectorAll("img"))

    expect(images.length).toBeGreaterThanOrEqual(KICKBOXING_GALLERY.length)
    images.forEach((image) => {
      expect((image.getAttribute("alt") ?? "").trim().length).toBeGreaterThan(0)
    })
  })

  it("points the hero WhatsApp call to action at the kickboxing message", () => {
    renderedKickboxing = renderKickboxing()
    const expectedUrl = getMarketingWhatsAppUrl(KICKBOXING_WHATSAPP_MESSAGE)
    const whatsappLinks = Array.from(renderedKickboxing.container.querySelectorAll("a")).filter(
      (link) => (link.getAttribute("href") ?? "").startsWith("https://wa.me/"),
    )

    expect(whatsappLinks).toHaveLength(1)
    expect(whatsappLinks[0].textContent).toBe("QUIERO ENTRENAR")
    expect(whatsappLinks[0].getAttribute("href")).toBe(expectedUrl)
  })

  it("omits the closing call to action already covered by the footer", () => {
    renderedKickboxing = renderKickboxing()
    const pageText = renderedKickboxing.container.textContent ?? ""

    expect(pageText).not.toContain("TU PRIMERA GUARDIA EMPIEZA AQUÍ.")
    expect(pageText).not.toContain("ESCRIBIR POR WHATSAPP")
  })
})
