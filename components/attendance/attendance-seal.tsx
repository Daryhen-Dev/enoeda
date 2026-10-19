import { cn } from "@/lib/utils"
import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec"

interface AttendanceSealProps {
  /**
   * Visible word rendered next to the seal (outside the SVG so it never
   * clips against the ring geometry). Decorative: the meaning lives in the
   * wrapper's aria-label.
   */
  label?: string
  /** Seal size: "md" (44px) for inline use, "lg" (96px) for the post-save overlay. */
  size?: "md" | "lg"
  /** When true the seal plays the one-shot stamp animation (reduced-motion aware). */
  stamped?: boolean
  className?: string
}

const SEAL_SIZE_CLASS = {
  md: "size-11",
  lg: "size-24",
} as const

/**
 * Vermilion hanko-style seal ("Tinta y sello"): a ring + inner rounded square
 * drawn with SVG geometry, holding a bold check mark, slightly rotated like a
 * hand stamp. Purely geometry — no illustration, no text inside the ring
 * (text used to overflow the fixed viewBox). The visible word renders beside
 * the seal; `role="img"` + aria-label on the wrapper carries the meaning, so
 * the label span is aria-hidden and announced only once.
 */
export function AttendanceSeal({
  label = ATTENDANCE_FORM_MESSAGES.SEAL_LABEL,
  size = "md",
  stamped = false,
  className,
}: AttendanceSealProps) {
  return (
    <span
      role="img"
      aria-label={ATTENDANCE_FORM_MESSAGES.SEAL_ARIA}
      className={cn("inline-flex shrink-0 items-center gap-2 text-seal", className)}
    >
      <svg
        viewBox="0 0 56 56"
        aria-hidden="true"
        className={cn(
          SEAL_SIZE_CLASS[size],
          "-rotate-8",
          stamped && "attendance-seal-stamp"
        )}
      >
        <circle
          cx="28"
          cy="28"
          r="26.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <rect
          x="9.5"
          y="9.5"
          width="37"
          height="37"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M18.5 28.5 L25 35 L38 21.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        aria-hidden="true"
        className="text-sm font-medium uppercase tracking-wide text-foreground"
      >
        {label}
      </span>
    </span>
  )
}
