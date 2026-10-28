interface BeltChipProps {
  levelName: string | null
  levelColor: string | null
}

/**
 * Belt "obi" strip: a small swatch always carrying a hairline border (so very
 * light belts like white stay visible on paper) and filled with the level
 * color whenever one exists. Rendering is deterministic on server and client
 * — no `CSS.supports` branching, which caused hydration mismatches and
 * uncolored swatches in server-rendered trees; browsers ignore invalid color
 * values, leaving the bordered hairline swatch. The level name travels via
 * `title` and visually-hidden text; no level means no text at all.
 *
 * The only chroma in the system besides the seal (One Chroma Rule), so every
 * surface that shows a belt reuses this one component.
 */
export function BeltChip({ levelName, levelColor }: BeltChipProps) {
  const hasColor = typeof levelColor === "string" && levelColor.length > 0
  return (
    <>
      <span
        title={levelName ?? undefined}
        aria-hidden={levelName ? undefined : true}
        className="h-5.5 w-2.5 shrink-0 rounded-full border border-border"
        style={hasColor ? { backgroundColor: levelColor } : undefined}
      />
      {levelName && <span className="sr-only">{levelName}</span>}
    </>
  )
}
