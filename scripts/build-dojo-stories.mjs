#!/usr/bin/env node
/**
 * Rebuilds the prerendered dojo-stories media from the source videos.
 *
 * Sources:   assets/<n>.mp4                (1-indexed, owner-provided)
 * Outputs:   public/media/dojo-stories/story-<0n>.mp4   (web-optimized h264 + aac)
 *            public/media/dojo-stories/story-<0n>.webp  (poster at encoded resolution)
 *
 * Pipeline per story:
 *   - h264 CRF 24 / preset medium / yuv420p, +faststart
 *   - fps capped at 30 (no frame duplication for slower sources)
 *   - scaled to max height 1280, even dimensions enforced
 *   - aac 128k when the source has audio, dropped otherwise
 *   - poster: webp quality 80, frame at 10% of duration (min 0.5s)
 *
 * Fails when a source is missing or the asset count does not match the
 * DOJO_STORIES catalog (components/marketing/home/sections/dojo-stories-catalog.ts).
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"

const ROOT = join(import.meta.dirname, "..")
const ASSETS_DIR = join(ROOT, "assets")
const OUTPUT_DIR = join(ROOT, "public", "media", "dojo-stories")
const CATALOG_PATH = join(
  ROOT,
  "components",
  "marketing",
  "home",
  "sections",
  "dojo-stories-catalog.ts",
)

const MAX_HEIGHT = 1280
const MAX_FPS = 30
const VIDEO_CRF = "24"
const VIDEO_PRESET = "medium"
const AUDIO_BITRATE = "128k"
const POSTER_QUALITY = 80
const POSTER_TIME_RATIO = 0.1
const POSTER_MIN_SECONDS = 0.5

function fail(message) {
  console.error(`[dojo-stories] ${message}`)
  process.exit(1)
}

function run(command, args, label) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true })
  if (result.error) {
    fail(`failed to launch ${label}: ${result.error.message}. Is ${command} on PATH?`)
  }
  if (result.status !== 0) {
    fail(`${label} exited with status ${result.status}`)
  }
}

function probeJson(file, selector) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      selector,
      "-show_entries",
      "stream=width,height,avg_frame_rate:format=duration",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8", windowsHide: true },
  )
  if (result.status !== 0 || !result.stdout) {
    fail(`ffprobe failed for ${file}`)
  }
  return JSON.parse(result.stdout)
}

function parseRational(value) {
  if (!value || value === "0/0") {
    return null
  }
  const [numerator, denominator = 1] = value.split("/").map(Number)
  if (!Number.isFinite(numerator) || denominator === 0) {
    return null
  }
  return numerator / denominator
}

function collectSources() {
  if (!existsSync(ASSETS_DIR)) {
    fail(`assets directory not found: ${ASSETS_DIR}`)
  }

  return readdirSync(ASSETS_DIR)
    .map((name) => /^(\d+)\.mp4$/.exec(name))
    .filter(Boolean)
    .map((match) => ({ number: Number(match[1]), file: join(ASSETS_DIR, match[0]) }))
    .sort((a, b) => a.number - b.number)
}

function readCatalogStoryIds() {
  if (!existsSync(CATALOG_PATH)) {
    fail(`catalog not found: ${CATALOG_PATH}`)
  }

  const catalog = readFileSync(CATALOG_PATH, "utf8")
  return [...catalog.matchAll(/id:\s*"(story-\d+)"/g)].map((match) => match[1])
}

function storyAssetNumber(storyId) {
  const match = /^story-(\d+)$/.exec(storyId)
  return match ? Number(match[1]) : null
}

function buildVideoFilters(sourceFps) {
  const filters = [
    `scale=-2:min(ih\\,${MAX_HEIGHT})`,
    "crop=trunc(iw/2)*2:trunc(ih/2)*2",
  ]
  if (sourceFps !== null && sourceFps > MAX_FPS) {
    filters.push(`fps=${MAX_FPS}`)
  }
  return filters.join(",")
}

function encodeStory({ number, file }) {
  const storyId = `story-${String(number).padStart(2, "0")}`
  const videoPath = join(OUTPUT_DIR, `${storyId}.mp4`)
  const posterPath = join(OUTPUT_DIR, `${storyId}.webp`)
  const probe = probeJson(file, "v:0")
  const videoStream = probe.streams?.[0]
  const audioProbe = probeJson(file, "a:0")
  const hasAudio = Boolean(audioProbe.streams?.[0])
  const sourceFps = parseRational(videoStream?.avg_frame_rate)

  console.log(
    `[dojo-stories] ${storyId}: ${basename(file)} ` +
      `${videoStream?.width}x${videoStream?.height}` +
      (sourceFps !== null ? ` @ ${sourceFps.toFixed(2)}fps` : "") +
      (hasAudio ? " (audio)" : " (no audio)"),
  )

  run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-stats",
      "-y",
      "-i",
      file,
      "-map",
      "0:v:0",
      ...(hasAudio ? ["-map", "0:a:0?"] : []),
      "-map_metadata",
      "-1",
      "-vf",
      buildVideoFilters(sourceFps),
      "-c:v",
      "libx264",
      "-crf",
      VIDEO_CRF,
      "-preset",
      VIDEO_PRESET,
      "-pix_fmt",
      "yuv420p",
      ...(hasAudio
        ? ["-c:a", "aac", "-b:a", AUDIO_BITRATE]
        : ["-an"]),
      "-movflags",
      "+faststart",
      videoPath,
    ],
    `encoding ${storyId}`,
  )

  const encoded = probeJson(videoPath, "v:0")
  const encodedStream = encoded.streams?.[0]
  const duration = Number(encoded.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) {
    fail(`encoded video has no duration: ${videoPath}`)
  }

  const posterTime = Math.max(POSTER_MIN_SECONDS, duration * POSTER_TIME_RATIO)
  run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      posterTime.toFixed(3),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      "-quality",
      String(POSTER_QUALITY),
      "-lossless",
      "0",
      posterPath,
    ],
    `poster for ${storyId}`,
  )

  return {
    storyId,
    dimensions: `${encodedStream?.width}x${encodedStream?.height}`,
    duration,
    hasAudio,
  }
}

function main() {
  const sources = collectSources()
  if (sources.length === 0) {
    fail(`no <n>.mp4 sources found in ${ASSETS_DIR}`)
  }

  const storyIds = readCatalogStoryIds()
  if (storyIds.length !== sources.length) {
    fail(
      `catalog has ${storyIds.length} stories but ${sources.length} source videos exist; ` +
        "update the catalog or the assets so both sides match",
    )
  }

  for (const storyId of storyIds) {
    const assetNumber = storyAssetNumber(storyId)
    if (assetNumber === null || !sources.some((source) => source.number === assetNumber)) {
      fail(`catalog story ${storyId} has no matching assets/<n>.mp4 source`)
    }
  }

  if (!existsSync(OUTPUT_DIR)) {
    fail(`output directory not found: ${OUTPUT_DIR}`)
  }

  const results = sources.map(encodeStory)

  console.log("\n[dojo-stories] rebuild complete:")
  for (const result of results) {
    console.log(
      `  ${result.storyId}.mp4  ${result.dimensions}  ${result.duration.toFixed(2)}s` +
        (result.hasAudio ? " (audio)" : " (no audio)"),
    )
  }
}

main()
