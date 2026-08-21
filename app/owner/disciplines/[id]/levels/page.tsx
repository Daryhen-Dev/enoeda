import { AlertCircleIcon, ArrowLeftIcon, LayersIcon } from "lucide-react"
import Link from "next/link"

import { LevelCatalogList } from "@/components/levels/level-catalog-list"
import { LevelFormDialog } from "@/components/levels/level-form-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getDisciplineLevelCatalog } from "@/lib/domain/levels/actions"
import { LEVEL_MESSAGES } from "@/lib/localization/es-ec"

interface LevelsPageProps {
  params: Promise<{ id: string }>
}

export default async function OwnerDisciplineLevelsPage({
  params,
}: LevelsPageProps) {
  const { id: disciplineId } = await params
  const result = await getDisciplineLevelCatalog({ discipline_id: disciplineId })

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            render={<Link href="/owner/disciplines" aria-label="Back" />}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <LayersIcon className="size-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {LEVEL_MESSAGES.PAGE_TITLE}
            </h2>
            <p className="text-sm text-muted-foreground">
              {LEVEL_MESSAGES.PAGE_DESCRIPTION}
            </p>
          </div>
        </div>
        {result.success && (
          <LevelFormDialog disciplineId={disciplineId} mode="create" />
        )}
      </div>

      {!result.success ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{LEVEL_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>{LEVEL_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      ) : (
        <LevelCatalogList
          levels={result.data?.levels ?? []}
          disciplineId={disciplineId}
          initialLevelId={result.data?.initial_level_id ?? null}
        />
      )}
    </div>
  )
}
