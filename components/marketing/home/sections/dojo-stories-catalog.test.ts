import { describe, expect, it } from "vitest"

import { DOJO_STORIES } from "./dojo-stories-catalog"

const EXPECTED_STORIES = [
  {
    id: "story-01",
    posterSrc: "/media/dojo-stories/story-01.webp",
    videoSrc: "/media/dojo-stories/story-01.mp4",
  },
  {
    id: "story-02",
    posterSrc: "/media/dojo-stories/story-02.webp",
    videoSrc: "/media/dojo-stories/story-02.mp4",
  },
  {
    id: "story-03",
    posterSrc: "/media/dojo-stories/story-03.webp",
    videoSrc: "/media/dojo-stories/story-03.mp4",
  },
  {
    id: "story-04",
    posterSrc: "/media/dojo-stories/story-04.webp",
    videoSrc: "/media/dojo-stories/story-04.mp4",
  },
  {
    id: "story-05",
    posterSrc: "/media/dojo-stories/story-05.webp",
    videoSrc: "/media/dojo-stories/story-05.mp4",
  },
  {
    id: "story-06",
    posterSrc: "/media/dojo-stories/story-06.webp",
    videoSrc: "/media/dojo-stories/story-06.mp4",
  },
  {
    id: "story-07",
    posterSrc: "/media/dojo-stories/story-07.webp",
    videoSrc: "/media/dojo-stories/story-07.mp4",
  },
] as const

describe("Dojo stories catalog", () => {
  it("keeps the seven stable public media entries in order", () => {
    expect(
      DOJO_STORIES.map(({ id, posterSrc, videoSrc }) => ({ id, posterSrc, videoSrc })),
    ).toEqual(EXPECTED_STORIES)
  })
})
