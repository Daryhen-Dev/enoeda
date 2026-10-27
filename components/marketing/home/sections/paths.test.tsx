// @vitest-environment jsdom

/**
 * MarketingPaths — the home directory (S1-S3 of odd/tasks/home-paths.md).
 *
 * The six entries are the dojo's own brief, verbatim. The two disciplines are
 * the primary pair; the other four form the secondary index. Destinations are
 * today's: pages that do not exist yet (legado, karate-do) point at their
 * current stand-ins until their own pages ship.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MARKETING_WHATSAPP_KARATE_URL, MARKETING_WHATSAPP_URL } from "@/components/marketing/shared/contact"

import { MarketingPaths } from "./paths"

type LinkProps = ComponentProps<"a"> & { href: string }

interface Rendered {
  container: HTMLElement
  unmount(): void
}

vi.mock("next/link", () => ({
  // Render next/link as a plain anchor so hrefs stay queryable.
  default: ({ href, children, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))


let rendered: Rendered | null = null

function render() {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MarketingPaths />)
  })
  rendered = { container, unmount: () => act(() => root.unmount()) }
  return rendered
}

function anchors(): HTMLAnchorElement[] {
  return [...rendered!.container.querySelectorAll("a")] as HTMLAnchorElement[]
}

function anchorByTitle(title: string): HTMLAnchorElement {
  const link = anchors().find((a) => a.textContent?.includes(title))
  if (!link) throw new Error(`no anchor for title: ${title}`)
  return link
}

afterEach(() => {
  rendered?.unmount()
  rendered = null
  document.body.innerHTML = ""
})

describe("MarketingPaths — the six entries (verbatim copy)", () => {
  it("renders every title and description from the dojo's brief", () => {
    render()
    const text = rendered!.container.textContent ?? ""

    const entries: Array<[string, string]> = [
      ["Legado del Sensei Keinosuke Enoeda", "Biografía, trayectoria, filosofía y legado histórico."],
      ["Karate-do", "Kihon, kata, kumite, grados y competición."],
      ["Kickboxing", "Técnica, acondicionamiento físico y combate."],
      ["Nuestro equipo", "Tu trayectoria, instructores y comunidad Enoeda."],
      ["Sedes y horarios", "Ubicaciones, clases, edades y horarios vigentes."],
      ["Eventos y contacto", "Copa Enoeda, actividades, WhatsApp e inscripciones."],
    ]
    for (const [title, description] of entries) {
      expect(text).toContain(title)
      expect(text).toContain(description)
    }
  })

  it("is announced as one section with its own heading", () => {
    render()
    const section = rendered!.container.querySelector("section")
    expect(section?.getAttribute("aria-labelledby")).toBe("paths-heading")
    expect(
      rendered!.container.querySelector("#paths-heading")?.textContent
    ).toContain("DOS DISCIPLINAS.")
  })
})

describe("MarketingPaths — destinations", () => {
  it("sends Kickboxing to its page", () => {
    render()
    expect(anchorByTitle("Kickboxing").getAttribute("href")).toBe("/kickboxing")
  })

  it("sends Karate-do to the karate WhatsApp while its page does not exist", () => {
    render()
    expect(anchorByTitle("Karate-do").getAttribute("href")).toBe(
      MARKETING_WHATSAPP_KARATE_URL
    )
  })

  it("points Legado at the history section until its page ships", () => {
    render()
    expect(
      anchorByTitle("Legado del Sensei Keinosuke Enoeda").getAttribute("href")
    ).toBe("/#dojo")
  })

  it("points the team at the masters section", () => {
    render()
    expect(anchorByTitle("Nuestro equipo").getAttribute("href")).toBe(
      "/#maestros"
    )
  })

  it("points Sedes y horarios at the locations section", () => {
    render()
    expect(anchorByTitle("Sedes y horarios").getAttribute("href")).toBe(
      "/#sedes"
    )
  })

  it("sends Eventos y contacto to the general WhatsApp", () => {
    render()
    expect(anchorByTitle("Eventos y contacto").getAttribute("href")).toBe(
      MARKETING_WHATSAPP_URL
    )
  })

  it("opens WhatsApp links in a new tab and keeps internal ones in-app", () => {
    render()
    expect(anchorByTitle("Karate-do").getAttribute("target")).toBe("_blank")
    expect(anchorByTitle("Kickboxing").getAttribute("target")).toBeNull()
  })
})
