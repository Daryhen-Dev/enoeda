import { AlertCircleIcon, BookOpenIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DisciplineList } from "@/components/owner/discipline-list"
import { DisciplineCreateDialog } from "@/components/owner/discipline-create-dialog"
import { listDisciplines } from "@/lib/domain/disciplines/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

/**
 * Owner disciplines management page — create and list disciplines.
 */
export default async function OwnerDisciplinesPage() {
  const result = await listDisciplines()

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <BookOpenIcon className="size-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {OWNER_MESSAGES.DISCIPLINES}
            </h2>
            <p className="text-sm text-muted-foreground">
              {OWNER_MESSAGES.DISCIPLINES_DESCRIPTION}
            </p>
          </div>
        </div>
        <DisciplineCreateDialog />
      </div>

      {!result.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{OWNER_MESSAGES.DISCIPLINES}</AlertTitle>
          <AlertDescription>{OWNER_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      ) : (
        <DisciplineList disciplines={result.data ?? []} />
      )}
    </div>
  )
}
