export interface DojoStory {
  id: string
  posterSrc: string
  title: string
  videoSrc: string
}

export const DOJO_STORIES = [
  {
    id: "story-01",
    posterSrc: "/media/dojo-stories/story-01.webp",
    title: "La práctica empieza aquí",
    videoSrc: "/media/dojo-stories/story-01.mp4",
  },
  {
    id: "story-02",
    posterSrc: "/media/dojo-stories/story-02.webp",
    title: "Técnica en movimiento",
    videoSrc: "/media/dojo-stories/story-02.mp4",
  },
  {
    id: "story-03",
    posterSrc: "/media/dojo-stories/story-03.webp",
    title: "Compartir el tatami",
    videoSrc: "/media/dojo-stories/story-03.mp4",
  },
  {
    id: "story-04",
    posterSrc: "/media/dojo-stories/story-04.webp",
    title: "La fuerza de la constancia",
    videoSrc: "/media/dojo-stories/story-04.mp4",
  },
  {
    id: "story-05",
    posterSrc: "/media/dojo-stories/story-05.webp",
    title: "Cada detalle cuenta",
    videoSrc: "/media/dojo-stories/story-05.mp4",
  },
  {
    id: "story-06",
    posterSrc: "/media/dojo-stories/story-06.webp",
    title: "Entrenar con propósito",
    videoSrc: "/media/dojo-stories/story-06.mp4",
  },
  {
    id: "story-07",
    posterSrc: "/media/dojo-stories/story-07.webp",
    title: "El dojo nos reúne",
    videoSrc: "/media/dojo-stories/story-07.mp4",
  },
] as const satisfies readonly DojoStory[]
