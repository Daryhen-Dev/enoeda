import { describe, expect, it } from "vitest"

import { MARKETING_NAVIGATION } from "./navigation"

describe("MARKETING_NAVIGATION", () => {
  it("contains only the approved anchor destinations", () => {
    expect(MARKETING_NAVIGATION.map((item) => item.href)).toEqual([
      "#historia",
      "#maestros",
    ])
  })

  it("labels the approved destinations in order", () => {
    expect(MARKETING_NAVIGATION.map((item) => item.label)).toEqual([
      "Historia",
      "Maestros",
    ])
  })
})
