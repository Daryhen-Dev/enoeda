// @vitest-environment jsdom

import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec"

import { AttendanceSeal } from "./attendance-seal"

interface RenderedSeal {
  container: HTMLElement
  unmount(): void
}

function renderSeal(
  props: Omit<Parameters<typeof AttendanceSeal>[0], never> = {}
): RenderedSeal {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<AttendanceSeal {...props} />)
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

describe("AttendanceSeal", () => {
  let rendered: RenderedSeal | undefined

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
  })

  it("exposes role=img with the registered-attendance aria-label", () => {
    rendered = renderSeal()

    const seal = rendered.container.querySelector('[role="img"]')
    expect(seal).not.toBeNull()
    expect(seal!.getAttribute("aria-label")).toBe(
      ATTENDANCE_FORM_MESSAGES.SEAL_ARIA
    )
    expect(seal!.getAttribute("aria-label")).toBe("Asistencia registrada")
  })

  it("draws a bold check mark inside the ring instead of clipping text", () => {
    rendered = renderSeal()

    // No text element: the word used to overflow the fixed 56-unit viewBox.
    expect(rendered.container.querySelector("svg text")).toBeNull()

    const check = rendered.container.querySelector("svg path")
    expect(check).not.toBeNull()
    expect(check!.getAttribute("stroke")).toBe("currentColor")
    expect(check!.getAttribute("stroke-width")).toBe("3.5")
    expect(check!.getAttribute("stroke-linecap")).toBe("round")
    // The ring and the inner rounded square are still drawn.
    expect(rendered.container.querySelector("svg circle")).not.toBeNull()
    expect(rendered.container.querySelector("svg rect")).not.toBeNull()
  })

  it("renders the visible label outside the seal, announced only via the aria-label", () => {
    rendered = renderSeal()

    const seal = rendered.container.querySelector('[role="img"]')!
    const visibleLabel = Array.from(seal.children).find(
      (child) => child.tagName === "SPAN"
    ) as HTMLElement | undefined
    expect(visibleLabel).toBeDefined()
    expect(visibleLabel!.textContent).toBe(
      ATTENDANCE_FORM_MESSAGES.SEAL_LABEL
    )
    // Avoids double announcement: the wrapper is the accessible image.
    expect(visibleLabel!.getAttribute("aria-hidden")).toBe("true")
    // Ink, not seal red, so the label passes contrast.
    expect(visibleLabel!.className).toContain("text-foreground")
  })

  it("marks the stamp animation only on the svg when stamped is true", () => {
    rendered = renderSeal({ stamped: false })
    let seal = rendered.container.querySelector('[role="img"]')!
    let svg = seal.querySelector("svg")!
    expect(svg.className.baseVal).not.toContain("attendance-seal-stamp")

    rendered.unmount()
    rendered = renderSeal({ stamped: true })
    seal = rendered.container.querySelector('[role="img"]')!
    svg = seal.querySelector("svg")!
    expect(svg.className.baseVal).toContain("attendance-seal-stamp")
    // The wrapper itself carries no animation class.
    expect(seal.className).not.toContain("attendance-seal-stamp")
  })

  it("sizes the svg geometry (md default 44px, lg 96px for the overlay)", () => {
    rendered = renderSeal()
    let svg = rendered.container.querySelector("svg")!
    expect(svg.className.baseVal).toContain("size-11")

    rendered.unmount()
    rendered = renderSeal({ size: "lg" })
    svg = rendered.container.querySelector("svg")!
    expect(svg.className.baseVal).toContain("size-24")
  })
})
