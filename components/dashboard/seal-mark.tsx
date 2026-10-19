import { cn } from "@/lib/utils";

import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec";

/**
 * Small vermilion seal mark ("Tinta y sello") for ledger rows at 24px.
 * It does NOT reuse the 56-unit hanko geometry: at 24px the hanko's 1.5-unit
 * inner square is sub-pixel mush, so this mark is re-derived for the size it
 * actually ships — a single 2-unit ring and a bold 2.25-unit check with round
 * caps, no inner square. The full ring + inner square hanko lives in
 * AttendanceSeal at 44px+, where the geometry survives. Marks a sealed (done)
 * row only — the vermilion seal never appears on pending or suspended rows.
 * Meaning is announced exactly once via role="img" + aria-label; no text
 * lives inside the ring.
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
        r="10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M7.9 12.2 L10.7 15 L16.3 9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
