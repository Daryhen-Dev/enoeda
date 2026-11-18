// @vitest-environment jsdom

/**
 * MarketingPaths — the home directory (S1-S3 of odd/tasks/home-paths.md).
 *
 * The six entries are the dojo's own brief, verbatim. The two disciplines are
 * the primary pair; the other four form the secondary index. Both disciplines
 * now open their own page; only the general WhatsApp entries stay external.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MARKETING_WHATSAPP_URL } from "@/components/marketing/shared/contact"

import { MarketingPaths } from "./paths"

type LinkProps = ComponentProps<"a"> & { href: string }
type ImageProps = ComponentProps<"img"> & { src: string | { src: string } }

interface Rendered {
  container: HTMLElement
  unmount(): void
}

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: ImageProps) => {
    const resolved = typeof src === "string" ? src : src.src

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={className} data-image-src={resolved} src={resolved} />
    )
  },
}))

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

  it("opens the directory with the dojo seal, decorative because the header names the dojo", () => {
    render()
    const images = Array.from(rendered!.container.querySelectorAll("img"))

    expect(images).toHaveLength(1)
    expect(images[0].getAttribute("alt")).toBe("")
    expect(images[0].getAttribute("src")).toContain("enoeda-logo")
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

  it("sends Karate-do to its page", () => {
    render()
    expect(anchorByTitle("Karate-do").getAttribute("href")).toBe("/karate")
  })

  it("points Legado at its own page", () => {
    render()
    expect(
      anchorByTitle("Legado del Sensei Keinosuke Enoeda").getAttribute("href")
    ).toBe("/legado")
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
    expect(anchorByTitle("Eventos y contacto").getAttribute("target")).toBe("_blank")
    expect(anchorByTitle("Karate-do").getAttribute("target")).toBeNull()
    expect(anchorByTitle("Kickboxing").getAttribute("target")).toBeNull()
  })
})
