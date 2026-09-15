import { describe, expect, it } from "vitest"

import {
  getDojoStoryVideoProgress,
  getNextDojoStoryIndex,
  getPreviousDojoStoryIndex,
} from "./dojo-story-viewer-state"

describe("Dojo story viewer transitions", () => {
  it("advances through the final story and then signals closure", () => {
    expect(getNextDojoStoryIndex(0, 7)).toBe(1)
    expect(getNextDojoStoryIndex(5, 7)).toBe(6)
    expect(getNextDojoStoryIndex(6, 7)).toBeNull()
  })

  it("does not navigate before the first story", () => {
    expect(getPreviousDojoStoryIndex(0)).toBeNull()
    expect(getPreviousDojoStoryIndex(3)).toBe(2)
  })

  it("calculates safe, bounded video progress", () => {
    expect(getDojoStoryVideoProgress(15, 60)).toBe(0.25)
    expect(getDojoStoryVideoProgress(-1, 60)).toBe(0)
    expect(getDojoStoryVideoProgress(90, 60)).toBe(1)
    expect(getDojoStoryVideoProgress(0, 0)).toBe(0)
    expect(getDojoStoryVideoProgress(0, Number.NaN)).toBe(0)
    expect(getDojoStoryVideoProgress(0, Number.POSITIVE_INFINITY)).toBe(0)
  })
})
