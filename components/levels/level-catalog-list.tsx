"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  setInitialLevel,
  type LevelRecord,
} from "@/lib/domain/levels/actions"
import { COMMON_MESSAGES, LEVEL_MESSAGES } from "@/lib/localization/es-ec"
import { LevelFormDialog } from "./level-form-dialog"

interface LevelCatalogListProps {
  levels: LevelRecord[]
  disciplineId: string
  initialLevelId: string | null
}

export function LevelCatalogList({
  levels,
  disciplineId,
  initialLevelId,
}: LevelCatalogListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSetInitialLevel(levelId: string) {
    startTransition(async () => {
      const result = await setInitialLevel({
        discipline_id: disciplineId,
        level_id: levelId,
      })

      if (result.success) {
        toast.success(LEVEL_MESSAGES.INITIAL_LEVEL_CONFIGURED)
        router.refresh()
      } else {
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  if (levels.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{LEVEL_MESSAGES.EMPTY_STATE}</EmptyTitle>
          <EmptyDescription>
            {LEVEL_MESSAGES.EMPTY_STATE_DESCRIPTION}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{LEVEL_MESSAGES.SORT_ORDER_LABEL}</TableHead>
          <TableHead>{LEVEL_MESSAGES.NAME_LABEL}</TableHead>
          <TableHead>{LEVEL_MESSAGES.COLOR_LABEL}</TableHead>
          <TableHead>{LEVEL_MESSAGES.REQUIRED_SESSIONS_LABEL}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {levels.map((level) => {
          const isInitialLevel = level.id === initialLevelId

          return (
            <TableRow key={level.id}>
              <TableCell>{level.sort_order}</TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{level.name}</span>
                  {isInitialLevel && (
                    <Badge variant="secondary">
                      {LEVEL_MESSAGES.INITIAL_LEVEL_LABEL}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {level.color ? (
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: level.color }}
                    />
                    {level.color}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{level.required_attended_sessions}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {!isInitialLevel && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleSetInitialLevel(level.id)}
                    >
                      {isPending
                        ? LEVEL_MESSAGES.DEFINING_INITIAL_LEVEL
                        : LEVEL_MESSAGES.SET_AS_INITIAL_LEVEL}
                    </Button>
                  )}
                  <LevelFormDialog
                    disciplineId={disciplineId}
                    mode="edit"
                    level={level}
                  />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
