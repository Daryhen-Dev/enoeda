// @vitest-environment jsdom

/**
 * MarketingHero — the institutional message routes to the two disciplines
 * (S4 of odd/tasks/home-paths.md): ENTRENAR KARATE and ENTRENAR KICKBOXING.
 */

import type { ComponentProps } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MARKETING_WHATSAPP_KARATE_URL } from "@/components/marketing/shared/contact"

type LinkProps = ComponentProps<"a"> & { href: string }

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { MarketingHero } from "./hero"

vi.mock("next/image", () => ({
  // Plain <img> on purpose: hero markup stays queryable without next/image.
  default: ({ alt, src }: ComponentProps<"img"> & { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-image-src={src} src={src} />
  ),
}))

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
    root.render(<MarketingHero />)
  })
  rendered = { container, unmount: () => act(() => root.unmount()) }
}

function anchorByText(text: string): HTMLAnchorElement {
  const link = Array.from(
    rendered!.container.querySelectorAll("a")
  ).find((a) => a.textContent?.trim() === text)
  if (!link) throw new Error(`no anchor: ${text}`)
  return link
}

afterEach(() => {
  rendered?.unmount()
  rendered = null
  document.body.innerHTML = ""
})

describe("MarketingHero — two discipline paths", () => {
  it("offers ENTRENAR KARATE through the karate WhatsApp", () => {
    render()
    expect(anchorByText("ENTRENAR KARATE").getAttribute("href")).toBe(
      MARKETING_WHATSAPP_KARATE_URL
    )
  })

  it("offers ENTRENAR KICKBOXING through its page", () => {
    render()
    expect(anchorByText("ENTRENAR KICKBOXING").getAttribute("href")).toBe(
      "/kickboxing"
    )
  })

  it("keeps the institutional credentials line", () => {
    render()
    const text = rendered!.container.textContent ?? ""
    expect(text).toContain("Club formativo especializado de Karate y Kickboxing.")
    expect(text).toContain("Acuerdo Ministerial 143")
  })
})
