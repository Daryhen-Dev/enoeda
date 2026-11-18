// @vitest-environment jsdom

/**
 * MarketingLegado — the Sensei Keinosuke Enoeda biography page.
 *
 * The page is deliberately short: who he was, why he was "the Tiger", what he
 * did, his philosophy and his death. These tests pin that shape and the facts
 * the copy can never lose.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MARKETING_WHATSAPP_URL } from "@/components/marketing/shared/contact"

type LinkProps = ComponentProps<"a"> & { href: string }

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
  it("opens with the Tiger hero and the dojo's name connection", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("EL TIGRE.")
    expect(text).toContain("KEINOSUKE ENOEDA")
    expect(text).toContain("1935 – 2003")
    expect(text).toContain("Nuestro dojo lleva su nombre.")
  })

  it("answers the five questions the page exists for", () => {
    render()
    const headings = [
      "DE KYUSHU AL TATAMI.",
      "POR QUÉ LO LLAMABAN TORA.",
      "LLEVÓ EL SHOTOKAN A EUROPA.",
      "EL TALENTO SIN PRÁCTICA DIARIA NO SIGNIFICA NADA.",
      "MURIÓ EL 29 DE MARZO.",
    ]
    for (const heading of headings) {
      expect(rendered!.container.textContent).toContain(heading)
    }
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

  it("states when he died without inventing a cause", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("29 de marzo de 2003")
    expect(text).toContain("67 años")
    expect(text.toLowerCase()).not.toContain("cáncer")
  })

  it("drops the separate timeline so the page stays short", () => {
    render()

    expect(rendered!.container.querySelector("#legado-timeline")).toBeNull()
    expect(rendered!.container.textContent).not.toContain("UNA VIDA, DÍA POR DÍA.")
  })
})

describe("MarketingLegado — closing actions", () => {
  it("closes with ENTRENA EN SU NOMBRE and a WhatsApp contact", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("ENTRENA")
    expect(text).toContain("EN SU NOMBRE.")
    const whatsapp = [...rendered!.container.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === MARKETING_WHATSAPP_URL
    )
    expect(whatsapp?.textContent).toContain("ESCRIBIR POR WHATSAPP")
  })

  it("links the visitor to the locations section", () => {
    render()
    const sedes = [...rendered!.container.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === "/#sedes"
    )
    expect(sedes?.textContent).toContain("CONOCER LAS SEDES")
  })
})
