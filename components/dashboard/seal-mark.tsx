import { cn } from "@/lib/utils";

import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec";

/**
 * Small vermilion seal mark ("Tinta y sello") for ledger rows: the same
 * ring + inner rounded square + check geometry as AttendanceSeal at 24px,
 * without the side label. Marks a sealed (done) row only — the vermilion
 * seal never appears on pending or suspended rows. Meaning is announced
 * exactly once via role="img" + aria-label; no text lives inside the ring.
 */
export function SealMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 56"
      role="img"
      aria-label={ATTENDANCE_FORM_MESSAGES.SEAL_ARIA}
      className={cn("size-6 shrink-0 -rotate-8 text-seal", className)}
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
  );
}
