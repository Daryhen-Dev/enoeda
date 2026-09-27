import { describe, expect, it } from "vitest"

import { DOJO_STORIES } from "./dojo-stories-catalog"
import { DOJO_STORIES_MEDIA_VERSIONS } from "./dojo-stories-media-version"

const EXPECTED_STORY_IDS = [
  "story-01",
  "story-02",
  "story-03",
  "story-04",
  "story-05",
  "story-06",
  "story-07",
] as const

const MEDIA_VERSIONS = DOJO_STORIES_MEDIA_VERSIONS as Record<string, string | undefined>

describe("Dojo stories catalog", () => {
  it("keeps the seven stable public media entries in order", () => {
    expect(DOJO_STORIES.map((story) => story.id)).toEqual(EXPECTED_STORY_IDS)
  })

  it("labels every story", () => {
    for (const story of DOJO_STORIES) {
      expect(story.title.trim().length).toBeGreaterThan(0)
    }
  })

  it("points every story at its own prerendered media", () => {
    for (const story of DOJO_STORIES) {
      expect(story.posterSrc).toMatch(
        new RegExp(`^/media/dojo-stories/${story.id}\\.webp\\?v=[0-9a-f]{8}$`),
      )
      expect(story.videoSrc).toMatch(
        new RegExp(`^/media/dojo-stories/${story.id}\\.mp4\\?v=[0-9a-f]{8}$`),
      )
    }
  })

  it("cache-busts each url with the generated content version for that story", () => {
    for (const story of DOJO_STORIES) {
      const version = MEDIA_VERSIONS[story.id]

      expect(version, `missing media version for ${story.id}`).toBeDefined()
      expect(story.posterSrc).toBe(`/media/dojo-stories/${story.id}.webp?v=${version}`)
      expect(story.videoSrc).toBe(`/media/dojo-stories/${story.id}.mp4?v=${version}`)
    }
  })

  it("has a media version for every catalog story and no orphans", () => {
    expect(Object.keys(MEDIA_VERSIONS).sort()).toEqual([...EXPECTED_STORY_IDS].sort())
  })
})
