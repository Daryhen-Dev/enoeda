export function getNextDojoStoryIndex(currentIndex: number, storyCount: number) {
  const nextIndex = currentIndex + 1

  return nextIndex < storyCount ? nextIndex : null
}

export function getPreviousDojoStoryIndex(currentIndex: number) {
  return currentIndex > 0 ? currentIndex - 1 : null
}

export function getDojoStoryVideoProgress(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return Math.min(Math.max(currentTime / duration, 0), 1)
}
