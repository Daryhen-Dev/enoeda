import { DOJO_STORIES_MEDIA_VERSIONS } from "./dojo-stories-media-version"

export interface DojoStory {
  id: string
  posterSrc: string
  title: string
  videoSrc: string
}

const DOJO_STORY_ENTRIES = [
  { id: "story-01", title: "Detenerse nunca" },
  { id: "story-02", title: "Técnica en movimiento" },
  { id: "story-03", title: "Compartir el tatami" },
  { id: "story-04", title: "La fuerza de la constancia" },
  { id: "story-05", title: "Cada detalle cuenta" },
  { id: "story-06", title: "Entrenar con propósito" },
  { id: "story-07", title: "El dojo nos reúne" },
] as const

function mediaSrc(storyId: string, fileName: string) {
  const version = (DOJO_STORIES_MEDIA_VERSIONS as Record<string, string | undefined>)[
    storyId
  ]

  if (!version) {
    throw new Error(
      `Missing prerendered media version for "${storyId}". ` +
        "Run `pnpm stories:build` to regenerate it.",
    )
  }

  return `/media/dojo-stories/${fileName}?v=${version}`
}

export const DOJO_STORIES = DOJO_STORY_ENTRIES.map(({ id, title }) => ({
  id,
  title,
  posterSrc: mediaSrc(id, `${id}.webp`),
  videoSrc: mediaSrc(id, `${id}.mp4`),
})) satisfies readonly DojoStory[]
