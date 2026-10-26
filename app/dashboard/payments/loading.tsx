import { SECTION_SKELETON_VARIANT, SectionSkeleton } from "@/components/shell/section-skeleton"
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec"

/** Loading boundary: the shell answers immediately while this section streams. */
export default function Loading() {
  return (
    <SectionSkeleton
      variant={SECTION_SKELETON_VARIANT.PANEL}
      label={DASHBOARD_SHELL_MESSAGES.PAYMENTS}
    />
  )
}
