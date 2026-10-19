import { describe, expect, it } from "vitest"

import { formatOverviewDate } from "./overview-date"

describe("formatOverviewDate", () => {
  it("labels the given calendar date without shifting it to the previous day", () => {
    expect(formatOverviewDate("2026-10-19")).toBe("Lunes, 19 de octubre")
  })

  it("keeps month boundaries on the same day", () => {
    expect(formatOverviewDate("2026-11-01")).toBe("Domingo, 1 de noviembre")
  })
})
