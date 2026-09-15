"use client"

import Image from "next/image"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

import { DOJO_STORIES } from "./dojo-stories-catalog"
import {
  getDojoStoryVideoProgress,
  getNextDojoStoryIndex,
  getPreviousDojoStoryIndex,
} from "./dojo-story-viewer-state"

const VIDEO_PLAYBACK_STATUS = {
  ERROR: "error",
  LOADING: "loading",
  PAUSED: "paused",
  PLAYING: "playing",
  REQUIRES_INTERACTION: "requires-interaction",
} as const

type VideoPlaybackStatus =
  (typeof VIDEO_PLAYBACK_STATUS)[keyof typeof VIDEO_PLAYBACK_STATUS]

function releaseVideo(video: HTMLVideoElement | null) {
  if (!video) {
    return
  }

  video.pause()
  video.removeAttribute("src")
  video.load()
}

async function playVideoWithSound(video: HTMLVideoElement) {
  video.muted = false
  video.volume = 1
  await video.play()
}

export function MarketingDojoStories() {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackStatus, setPlaybackStatus] = useState<VideoPlaybackStatus>(
    VIDEO_PLAYBACK_STATUS.LOADING,
  )
  const [activeStoryProgress, setActiveStoryProgress] = useState(0)
  const [pendingAutoplayStoryId, setPendingAutoplayStoryId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const activeStory = activeStoryIndex === null ? null : (DOJO_STORIES[activeStoryIndex] ?? null)
  const activeStoryId = activeStory?.id

  useEffect(() => {
    if (!activeStoryId || pendingAutoplayStoryId !== activeStoryId) {
      return
    }

    const video = videoRef.current
    if (!video) {
      return
    }

    setPendingAutoplayStoryId(null)
    void attemptPlaybackWithSound(video)
  }, [activeStoryId, pendingAutoplayStoryId])

  useEffect(() => {
    if (!activeStoryId) {
      return
    }

    const video = videoRef.current
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        return
      }

      video?.pause()
      setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PAUSED)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      video?.pause()
    }
  }, [activeStoryId])

  function attemptPlaybackWithSound(video: HTMLVideoElement) {
    void playVideoWithSound(video)
      .then(() => {
        setIsMuted(false)
        setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PLAYING)
      })
      .catch(() => {
        setPlaybackStatus(VIDEO_PLAYBACK_STATUS.REQUIRES_INTERACTION)
      })
  }

  function openStory(storyIndex: number) {
    setPendingAutoplayStoryId(null)

    flushSync(() => {
      setIsMuted(false)
      setActiveStoryProgress(0)
      setPlaybackStatus(VIDEO_PLAYBACK_STATUS.LOADING)
      setActiveStoryIndex(storyIndex)
    })

    const video = videoRef.current
    if (video) {
      attemptPlaybackWithSound(video)
    }
  }

  function closeViewer() {
    releaseVideo(videoRef.current)
    setPendingAutoplayStoryId(null)
    setActiveStoryProgress(0)
    setActiveStoryIndex(null)
    setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PAUSED)
  }

  function goToStory(storyIndex: number) {
    const nextStory = DOJO_STORIES[storyIndex]
    if (!nextStory) {
      return
    }

    releaseVideo(videoRef.current)
    setIsMuted(false)
    setActiveStoryProgress(0)
    setPlaybackStatus(VIDEO_PLAYBACK_STATUS.LOADING)
    setActiveStoryIndex(storyIndex)
    setPendingAutoplayStoryId(nextStory.id)
  }

  function playCurrentStory() {
    const video = videoRef.current
    if (!video) {
      return
    }

    attemptPlaybackWithSound(video)
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      playCurrentStory()
      return
    }

    video.pause()
    setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PAUSED)
  }

  function toggleSound() {
    const video = videoRef.current
    if (!video) {
      return
    }

    const nextMutedState = !video.muted
    video.muted = nextMutedState
    setIsMuted(nextMutedState)
  }

  function handleStoryEnd() {
    if (activeStoryIndex === null) {
      return
    }

    const nextStoryIndex = getNextDojoStoryIndex(activeStoryIndex, DOJO_STORIES.length)

    if (nextStoryIndex === null) {
      closeViewer()
      return
    }

    goToStory(nextStoryIndex)
  }

  function handleVideoProgress(video: HTMLVideoElement) {
    setActiveStoryProgress(getDojoStoryVideoProgress(video.currentTime, video.duration))
  }

  function handleVideoError() {
    setPlaybackStatus(VIDEO_PLAYBACK_STATUS.ERROR)
  }

  function retryPlayback() {
    setActiveStoryProgress(0)

    const video = videoRef.current
    if (!video) {
      return
    }

    video.load()
    playCurrentStory()
  }

  function goToPreviousStory() {
    if (activeStoryIndex === null) {
      return
    }

    const previousStoryIndex = getPreviousDojoStoryIndex(activeStoryIndex)
    if (previousStoryIndex !== null) {
      goToStory(previousStoryIndex)
    }
  }

  function goToNextStory() {
    if (activeStoryIndex === null) {
      return
    }

    const nextStoryIndex = getNextDojoStoryIndex(activeStoryIndex, DOJO_STORIES.length)
    if (nextStoryIndex !== null) {
      goToStory(nextStoryIndex)
    }
  }

  return (
    <section
      aria-labelledby="dojo-stories-heading"
      className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
    >
      <div className="mx-auto max-w-360">
        <div className="grid gap-6 border-b-2 border-marketing-foreground pb-10 lg:grid-cols-12 lg:items-end">
          <h2
            className="font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground lg:col-span-8"
            id="dojo-stories-heading"
          >
            HISTORIAS DEL DOJO
          </h2>
          <p className="max-w-md font-marketing-body text-base leading-6 text-marketing-foreground lg:col-span-4 lg:mb-1">
            Momentos reales de la práctica: el ritmo del entrenamiento, la técnica y la comunidad que se construye en el tatami.
          </p>
        </div>

        <ul
          aria-label="Historias del dojo"
          className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 scroll-px-5 sm:-mx-8 sm:px-8 sm:scroll-px-8 lg:mx-0 lg:mt-14 lg:px-0 lg:scroll-px-0 xl:justify-center"
        >
          {DOJO_STORIES.map((story, storyIndex) => (
            <li
              className="w-[min(68vw,12rem)] shrink-0 snap-start lg:w-[clamp(6.5rem,11vw,9rem)]"
              key={story.id}
            >
              <button
                aria-label={`Abrir historia: ${story.title}`}
                className="group relative aspect-[9/14] w-full overflow-hidden rounded-2xl border border-marketing-menu-border/60 bg-marketing-muted text-left shadow-xl shadow-marketing-surface/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-marketing-accent/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transform-none motion-reduce:transition-none"
                onClick={() => openStory(storyIndex)}
                type="button"
              >
                <Image
                  alt=""
                  className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  fill
                  sizes="(min-width: 1024px) 9rem, (min-width: 640px) 12rem, 68vw"
                  src={story.posterSrc}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-marketing-surface/40 transition group-hover:bg-marketing-surface/20 motion-reduce:transition-none"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 border-t border-marketing-menu-border/50 bg-marketing-surface/60 p-3 backdrop-blur-sm">
                  <span className="font-marketing-display text-xl leading-none tracking-[0.02em] text-marketing-foreground sm:text-2xl">
                    {story.title}
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-marketing-menu-border bg-marketing-deep-accent text-marketing-foreground shadow-lg shadow-marketing-surface/50">
                    <PlayIcon aria-hidden="true" className="size-4 fill-current" />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeViewer()
          }
        }}
        open={activeStory !== null}
      >
        {activeStory && activeStoryIndex !== null && (
          <DialogContent
            className="inset-0 flex h-[100dvh] max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-marketing-surface p-0 text-marketing-foreground ring-0 sm:max-w-none"
            overlayClassName="bg-marketing-surface/95 supports-backdrop-filter:backdrop-blur-md"
            showCloseButton={false}
          >
            <div className="sr-only">
              <DialogTitle>Historias del Dojo: {activeStory.title}</DialogTitle>
              <DialogDescription>
                Reproductor de la historia {activeStoryIndex + 1} de {DOJO_STORIES.length}.
              </DialogDescription>
            </div>

            <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-marketing-surface px-3 py-3 sm:px-6 sm:py-5">
              <div className="relative h-[min(92dvh,47.75rem)] w-auto max-w-[calc(100vw-1.5rem)] aspect-[9/16] overflow-hidden rounded-2xl bg-marketing-muted shadow-2xl shadow-marketing-surface/70 sm:max-w-[min(calc(100vw-6rem),26.875rem)]">
                <video
                  className="h-full w-full object-contain"
                  key={activeStory.id}
                  onDurationChange={(event) => handleVideoProgress(event.currentTarget)}
                  onEnded={handleStoryEnd}
                  onError={handleVideoError}
                  onLoadedMetadata={(event) => handleVideoProgress(event.currentTarget)}
                  onPause={() => setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PAUSED)}
                  onPlay={() => setPlaybackStatus(VIDEO_PLAYBACK_STATUS.PLAYING)}
                  onTimeUpdate={(event) => handleVideoProgress(event.currentTarget)}
                  playsInline
                  poster={activeStory.posterSrc}
                  preload="metadata"
                  ref={videoRef}
                  src={activeStory.videoSrc}
                />

                <div className="absolute inset-x-0 top-0 z-10 bg-marketing-surface/75 p-3 backdrop-blur-sm sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-marketing-body text-xs font-bold uppercase tracking-[0.12em] text-marketing-menu-foreground sm:text-sm">
                      Historia {activeStoryIndex + 1} de {DOJO_STORIES.length}
                    </p>
                    <button
                      aria-label="Cerrar historias del dojo"
                      className="flex size-10 items-center justify-center rounded-full border border-marketing-menu-border text-marketing-foreground transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                      onClick={closeViewer}
                      type="button"
                    >
                      <XIcon aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                  <div aria-label="Progreso de historias" className="mt-3 flex gap-1.5">
                    {DOJO_STORIES.map((story, storyIndex) => (
                      <button
                        aria-current={storyIndex === activeStoryIndex ? "step" : undefined}
                        aria-label={`Ir a la historia ${storyIndex + 1}: ${story.title}`}
                        className="group flex h-4 flex-1 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-menu-border"
                        key={story.id}
                        onClick={() => goToStory(storyIndex)}
                        type="button"
                      >
                        <span className="h-1 w-full overflow-hidden rounded-full bg-marketing-foreground/30">
                          <span
                            aria-hidden="true"
                            className="block h-full origin-left bg-marketing-accent transition-transform duration-150 motion-reduce:transition-none"
                            style={{
                              transform: `scaleX(${storyIndex < activeStoryIndex ? 1 : storyIndex === activeStoryIndex ? activeStoryProgress : 0})`,
                            }}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {playbackStatus === VIDEO_PLAYBACK_STATUS.REQUIRES_INTERACTION && (
                  <div
                    aria-live="polite"
                    className="absolute inset-x-3 bottom-20 z-10 rounded-2xl border border-marketing-menu-border/70 bg-marketing-surface/90 p-3 shadow-xl shadow-marketing-surface/60 backdrop-blur-md sm:inset-x-4 sm:bottom-22 sm:p-4"
                    role="status"
                  >
                    <p className="font-marketing-body text-sm leading-5 text-marketing-foreground">
                      Tu navegador necesita una acción para iniciar el video con sonido.
                    </p>
                    <button
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-marketing-accent px-4 font-marketing-body text-sm font-bold uppercase tracking-[0.08em] text-marketing-foreground transition hover:bg-marketing-deep-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                      onClick={playCurrentStory}
                      type="button"
                    >
                      <PlayIcon aria-hidden="true" className="size-4 fill-current" />
                      Reproducir con sonido
                    </button>
                  </div>
                )}

                {playbackStatus === VIDEO_PLAYBACK_STATUS.ERROR && (
                  <div
                    aria-live="assertive"
                    className="absolute inset-x-3 bottom-20 z-10 rounded-2xl border border-marketing-menu-border/70 bg-marketing-surface/90 p-3 shadow-xl shadow-marketing-surface/60 backdrop-blur-md sm:inset-x-4 sm:bottom-22 sm:p-4"
                    role="alert"
                  >
                    <p className="font-marketing-body text-sm leading-5 text-marketing-foreground">
                      No se pudo reproducir esta historia. Podés intentar cargarla nuevamente.
                    </p>
                    <button
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-marketing-accent px-4 font-marketing-body text-sm font-bold uppercase tracking-[0.08em] text-marketing-foreground transition hover:bg-marketing-deep-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                      onClick={retryPlayback}
                      type="button"
                    >
                      <RotateCcwIcon aria-hidden="true" className="size-4" />
                      Intentar nuevamente
                    </button>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-marketing-surface/75 p-3 backdrop-blur-sm sm:p-4">
                  <button
                    aria-label="Historia anterior"
                    className="flex size-10 items-center justify-center rounded-full border border-marketing-menu-border text-marketing-foreground transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none md:hidden"
                    disabled={getPreviousDojoStoryIndex(activeStoryIndex) === null}
                    onClick={goToPreviousStory}
                    type="button"
                  >
                    <ChevronLeftIcon aria-hidden="true" className="size-5" />
                  </button>
                  <button
                    aria-label={playbackStatus === VIDEO_PLAYBACK_STATUS.PLAYING ? "Pausar historia" : "Reproducir historia"}
                    className="flex size-11 items-center justify-center rounded-full bg-marketing-accent text-marketing-foreground transition hover:bg-marketing-deep-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                    onClick={togglePlayback}
                    type="button"
                  >
                    {playbackStatus === VIDEO_PLAYBACK_STATUS.PLAYING ? (
                      <PauseIcon aria-hidden="true" className="size-5 fill-current" />
                    ) : (
                      <PlayIcon aria-hidden="true" className="size-5 fill-current" />
                    )}
                  </button>
                  <button
                    aria-label={isMuted ? "Activar sonido" : "Silenciar sonido"}
                    className="flex size-11 items-center justify-center rounded-full border border-marketing-menu-border text-marketing-foreground transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                    onClick={toggleSound}
                    type="button"
                  >
                    {isMuted ? (
                      <VolumeXIcon aria-hidden="true" className="size-5" />
                    ) : (
                      <Volume2Icon aria-hidden="true" className="size-5" />
                    )}
                  </button>
                  <button
                    aria-label="Historia siguiente"
                    className="flex size-10 items-center justify-center rounded-full border border-marketing-menu-border text-marketing-foreground transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none md:hidden"
                    disabled={getNextDojoStoryIndex(activeStoryIndex, DOJO_STORIES.length) === null}
                    onClick={goToNextStory}
                    type="button"
                  >
                    <ChevronRightIcon aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </div>

              <button
                aria-label="Historia anterior"
                className="absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-marketing-menu-border bg-marketing-surface/85 text-marketing-foreground shadow-xl shadow-marketing-surface/60 backdrop-blur-sm transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none md:flex lg:left-[calc(50%-18rem)]"
                disabled={getPreviousDojoStoryIndex(activeStoryIndex) === null}
                onClick={goToPreviousStory}
                type="button"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-6" />
              </button>
              <button
                aria-label="Historia siguiente"
                className="absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-marketing-menu-border bg-marketing-surface/85 text-marketing-foreground shadow-xl shadow-marketing-surface/60 backdrop-blur-sm transition hover:bg-marketing-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none md:flex lg:right-[calc(50%-18rem)]"
                disabled={getNextDojoStoryIndex(activeStoryIndex, DOJO_STORIES.length) === null}
                onClick={goToNextStory}
                type="button"
              >
                <ChevronRightIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
