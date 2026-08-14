"use client"

import { Badge } from "@/components/ui/badge"
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
import type { DisciplineRecord } from "@/lib/domain/disciplines/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

interface DisciplineListProps {
  disciplines: DisciplineRecord[]
}

export function DisciplineList({ disciplines }: DisciplineListProps) {
  if (disciplines.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{OWNER_MESSAGES.DISCIPLINES}</EmptyTitle>
          <EmptyDescription>
            {OWNER_MESSAGES.DISCIPLINES_DESCRIPTION}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{OWNER_MESSAGES.BRANCH_NAME}</TableHead>
          <TableHead>{DISCIPLINE_CODE_LABEL}</TableHead>
          <TableHead>{OWNER_MESSAGES.BRANCH_STATUS}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {disciplines.map((discipline) => (
          <TableRow key={discipline.id}>
            <TableCell className="font-medium">{discipline.name}</TableCell>
            <TableCell>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {discipline.code}
              </code>
            </TableCell>
            <TableCell>
              <Badge variant={discipline.is_active ? "default" : "secondary"}>
                {discipline.is_active
                  ? OWNER_MESSAGES.STATUS_ACTIVE
                  : OWNER_MESSAGES.STATUS_INACTIVE}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const DISCIPLINE_CODE_LABEL = "Código"
