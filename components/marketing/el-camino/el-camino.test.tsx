// @vitest-environment jsdom

/**
 * MarketingElCamino — the dojo's "path" page.
 *
 * It is a read surface, so the contract is that it stays readable: the seal
 * opens it, four blocks explain the path, and the copy never turns into the
 * eight-section wall it used to be.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

type LinkProps = ComponentProps<"a"> & { href: string }
type ImageProps = ComponentProps<"img"> & { src: string | { src: string } }

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: ImageProps) => {
    const resolved = typeof src === "string" ? src : src.src

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={className} data-image-src={resolved} src={resolved} />
    )
  },
}))

import { MarketingElCamino } from "./el-camino"

interface Rendered {
  container: HTMLElement
  unmount(): void
}

let rendered: Rendered | null = null

function render() {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MarketingElCamino />)
  })
  rendered = { container, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  rendered?.unmount()
  rendered = null
  document.body.innerHTML = ""
})

describe("MarketingElCamino — opening", () => {
  it("opens with the dojo seal, marked decorative because the header names the dojo", () => {
    render()
    const images = [...rendered!.container.querySelectorAll("img")]

    expect(images).toHaveLength(1)
    expect(images[0].getAttribute("alt")).toBe("")
    expect(images[0].getAttribute("src")).toContain("enoeda-logo")
  })

  it("keeps the headline and names both disciplines in the intro", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("MÁS QUE UN DOJO,")
    expect(text).toContain("UNA FAMILIA QUE CRECE CONTIGO.")
    expect(text).toContain("Karate y Kickboxing")
  })
})

describe("MarketingElCamino — the path in four blocks", () => {
  it("renders exactly four sections", () => {
    render()

    expect(rendered!.container.querySelectorAll("section")).toHaveLength(4)
  })

  it("keeps the four headings that carry the path", () => {
    render()
    const headings = [
      "EL CAMINO DEL KARATE.",
      "TÉCNICA Y CALMA EN KICKBOXING.",
      "NADIE CAMINA SOLO.",
      "EL VALOR DE COMENZAR.",
    ]

    expect([...rendered!.container.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(
      headings
    )
  })

  it("drops the sections that repeated what the four already say", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).not.toContain("CADA CINTURÓN CUENTA UNA HISTORIA.")
    expect(text).not.toContain("EL CINTURÓN NEGRO ES UN NUEVO COMIENZO.")
    expect(text).not.toContain("CRECER JUNTO A LA COMUNIDAD.")
    expect(text).not.toContain("EL DOJO NOS UNE.")
    expect(text).not.toContain("UN CAMINO SIN LÍMITES.")
  })

  it("stays readable: under 400 words of copy", () => {
    render()
    const words = (rendered!.container.textContent ?? "").split(/\s+/).filter(Boolean).length

    // 538 words over eight sections was the wall this page had before; the
    // budget is the contract, raise it deliberately rather than by accident.
    expect(words).toBeLessThan(400)
  })

  it("still sends the visitor to the sedes", () => {
    render()
    const sedes = [...rendered!.container.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === "/#sedes"
    )

    expect(sedes?.textContent).toContain("CONOCE NUESTRAS SEDES")
  })
})
