import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern"
import { describe, expect, it } from "vitest"

import nextConfig from "../../../../next.config"

import { DOJO_STORIES } from "./dojo-stories-catalog"

const localPatterns = nextConfig.images?.localPatterns

describe("Dojo stories media urls", () => {
  it("declares images.localPatterns so versioned posters are not rejected", () => {
    expect(localPatterns, "images.localPatterns must be configured").toBeDefined()
  })

  it("lets next/image serve every cache-busted poster", () => {
    for (const story of DOJO_STORIES) {
      expect(
        hasLocalMatch(localPatterns, story.posterSrc),
        `poster not covered by images.localPatterns: ${story.posterSrc}`,
      ).toBe(true)
    }
  })

  it("keeps the content version on the video source too", () => {
    for (const story of DOJO_STORIES) {
      expect(story.videoSrc).toMatch(/\?v=[0-9a-f]{8}$/)
    }
  })
})
