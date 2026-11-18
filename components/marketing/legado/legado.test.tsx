// @vitest-environment jsdom

/**
 * MarketingLegado — the Sensei Keinosuke Enoeda biography page.
 *
 * The page is deliberately short: who he was, why he was "the Tiger", what he
 * did, his philosophy. His death is a quiet coda, never a headline.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

type LinkProps = ComponentProps<"a"> & { href: string }
type ImageProps = ComponentProps<"img"> & { src: string | { src: string } }

vi.mock("next/image", () => ({
  // Plain <img> on purpose: the stub keeps `alt` queryable, which is the part
  // of the portrait the page contract actually cares about.
  default: ({ alt, className, src }: ImageProps) => {
    const resolved = typeof src === "string" ? src : src.src

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={className} data-image-src={resolved} src={resolved} />
    )
  },
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { MarketingLegado } from "./legado"

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
    root.render(<MarketingLegado />)
  })
  rendered = { container, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  rendered?.unmount()
  rendered = null
  document.body.innerHTML = ""
})

describe("MarketingLegado — structure", () => {
  it("opens with the Tiger hero, his portrait and the dojo's name connection", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("EL TIGRE.")
    expect(text).toContain("KEINOSUKE ENOEDA")
    expect(text).toContain("1935 – 2003")
    expect(text).toContain("Nuestro dojo lleva su nombre.")

    const portraits = [...rendered!.container.querySelectorAll("img")]
    expect(portraits).toHaveLength(1)
    expect(portraits[0].getAttribute("alt")).toContain("Keinosuke Enoeda")
  })

  it("answers the four questions the page exists for", () => {
    render()
    const headings = [
      "DE KYUSHU AL TATAMI.",
      "POR QUÉ LO LLAMABAN TORA.",
      "LLEVÓ EL SHOTOKAN A EUROPA.",
      "EL TALENTO SIN PRÁCTICA DIARIA NO SIGNIFICA NADA.",
    ]
    for (const heading of headings) {
      expect(rendered!.container.textContent).toContain(heading)
    }
    // hero + four narrative sections + closing block
    expect(rendered!.container.querySelectorAll("section")).toHaveLength(headings.length + 2)
  })

  it("keeps the nickname explained, not just displayed", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("Nakayama")
    expect(text).toContain("Tora")
  })

  it("keeps the facts of the trajectory", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("4 de julio de 1935")
    expect(text).toContain("Campeón de Japón")
    expect(text).toContain("1965")
    expect(text).toContain("Red Triangle Dojo")
    expect(text).toContain("9º Dan")
  })

  it("mentions his death as a quiet line, never under a display heading", () => {
    render()
    const text = rendered!.container.textContent ?? ""
    const headings = [...rendered!.container.querySelectorAll("h1, h2")].map((heading) =>
      (heading.textContent ?? "").toUpperCase()
    )

    expect(text).toContain("29 de marzo de 2003")
    expect(text).toContain("67 años")
    headings.forEach((heading) => {
      expect(heading).not.toContain("MURIÓ")
      expect(heading).not.toContain("MURIO")
      expect(heading).not.toContain("FALLECIÓ")
    })
    expect(text.toLowerCase()).not.toContain("cáncer")
  })

  it("drops the separate timeline so the page stays short", () => {
    render()

    expect(rendered!.container.querySelector("#legado-timeline")).toBeNull()
    expect(rendered!.container.textContent).not.toContain("UNA VIDA, DÍA POR DÍA.")
  })
})

describe("MarketingLegado — closing actions", () => {
  it("closes on the sedes list only, because the footer already carries WhatsApp", () => {
    render()
    const text = rendered!.container.textContent ?? ""
    const links = [...rendered!.container.querySelectorAll("a")]

    expect(text).toContain("ENTRENA")
    expect(text).toContain("EN SU NOMBRE.")
    expect(links.filter((anchor) => (anchor.getAttribute("href") ?? "").startsWith("https://wa.me/"))).toHaveLength(0)
    const sedes = links.find((anchor) => anchor.getAttribute("href") === "/#sedes")
    expect(sedes?.textContent).toContain("CONOCER LAS SEDES")
  })
})
