import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Dashboard not-found screen: the student detail calls `notFound()` when the
 * id does not exist in the active branch, and the framework default used to
 * replace the whole shell. This keeps the sidebar and header and points back to
 * the directory.
 */
export default function DashboardNotFound() {
  return (
    <main className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 md:p-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SearchXIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-[-0.01em]">
            {SECTION_FEEDBACK_MESSAGES.NOT_FOUND_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {SECTION_FEEDBACK_MESSAGES.NOT_FOUND_DESCRIPTION}
          </p>
        </div>
        <Link
          href="/dashboard/students"
          className={buttonVariants({ variant: "outline" })}
        >
          {SECTION_FEEDBACK_MESSAGES.NOT_FOUND_ACTION}
        </Link>
      </section>
    </main>
  )
}
