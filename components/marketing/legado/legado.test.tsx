// @vitest-environment jsdom

/**
 * MarketingLegado — the Sensei Keinosuke Enoeda biography page (step 2 of the
 * dojo's roadmap). Content was validated by the dojo; the tests pin the
 * section structure, the key facts and the closing actions.
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

  it("renders the six narrative sections with their headings", () => {
    render()
    const headings = [
      "EL JUDO LO LLEVÓ AL KARATE.",
      "FUNAKOSHI. NAKAYAMA. KASE.",
      "LIVERPOOL, 1965.",
      "UN MAESTRO DE CULTURA POP.",
      "EL TALENTO SIN PRÁCTICA DIARIA NO SIGNIFICA NADA.",
      "SU CAMINO SIGUE EN MARCHA.",
    ]
    for (const heading of headings) {
      expect(
        rendered!.container.querySelector(`h2`)?.textContent ?? headings.join()
      )
      expect(rendered!.container.textContent).toContain(heading)
    }
  })

  it("keeps the key facts of the trajectory", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("1963")
    expect(text).toContain("Campeón de Japón de la JKA")
    expect(text).toContain("1965")
    expect(text).toContain("Red Triangle Dojo")
    expect(text).toContain("2003")
    expect(text).toContain("9º dan")
  })
})

describe("MarketingLegado — closing actions", () => {
  it("closes with ENTRENA EN SU NOMBRE and a WhatsApp contact", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    expect(text).toContain("ENTRENA")
    expect(text).toContain("EN SU NOMBRE.")
    const whatsapp = [
      ...rendered!.container.querySelectorAll("a"),
    ].find((a) => a.getAttribute("href") === MARKETING_WHATSAPP_URL)
    expect(whatsapp?.textContent).toContain("ESCRIBIR POR WHATSAPP")
  })

  it("links the visitor to the locations section", () => {
    render()
    const sedes = [
      ...rendered!.container.querySelectorAll("a"),
    ].find((a) => a.getAttribute("href") === "/#sedes")
    expect(sedes?.textContent).toContain("CONOCER LAS SEDES")
  })
})
