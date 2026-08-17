"use client"

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
import { Badge } from "@/components/ui/badge"
import type { LevelRecord } from "@/lib/domain/levels/actions"
import { LEVEL_MESSAGES } from "@/lib/localization/es-ec"
import { LevelFormDialog } from "./level-form-dialog"

interface LevelCatalogListProps {
  levels: LevelRecord[]
  disciplineId: string
}

export function LevelCatalogList({
  levels,
  disciplineId,
}: LevelCatalogListProps) {
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
        {levels.map((level) => (
          <TableRow key={level.id}>
            <TableCell>{level.sort_order}</TableCell>
            <TableCell className="font-medium">{level.name}</TableCell>
            <TableCell>
              {level.color ? (
                <Badge
                  variant="outline"
                  className="gap-1.5"
                >
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
              <LevelFormDialog
                disciplineId={disciplineId}
                mode="edit"
                level={level}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
