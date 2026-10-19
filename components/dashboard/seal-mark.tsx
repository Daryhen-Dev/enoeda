import { cn } from "@/lib/utils";

import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec";

/**
 * Small vermilion seal mark ("Tinta y sello") for ledger rows at 24px.
 * Drawn on its own 24-unit grid instead of scaling the 56-unit hanko down
 * (scaled, the hanko's inner square falls below a pixel). At this grid every
 * stroke is at least one device pixel: a 1.75-unit ring, a 1-unit inner
 * rounded square — the stamp cue that keeps it from reading as a generic
 * check-circle — and a bold 2-unit check with round caps. The 44px+
 * AttendanceSeal keeps the full hanko. Marks a sealed (done) row only; the
 * vermilion seal never appears on pending or suspended rows. Meaning is
 * announced exactly once via role="img" + aria-label.
 */
export function SealMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={ATTENDANCE_FORM_MESSAGES.SEAL_ARIA}
      className={cn("size-6 shrink-0 -rotate-8 text-seal", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10.875"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M8.6 12.1 L10.9 14.4 L15.4 9.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
