"use client"

import Link from "next/link"
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
import type { DisciplineRecord } from "@/lib/domain/disciplines/actions"
import {
  DISCIPLINE_FORM_MESSAGES,
  LEVEL_MESSAGES,
  OWNER_MESSAGES,
} from "@/lib/localization/es-ec"
import { LayersIcon } from "lucide-react"

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
          <TableHead>{DISCIPLINE_FORM_MESSAGES.NAME_LABEL}</TableHead>
          <TableHead>{DISCIPLINE_FORM_MESSAGES.CODE_LABEL}</TableHead>
          <TableHead>{OWNER_MESSAGES.BRANCH_STATUS}</TableHead>
          <TableHead />
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
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                render={
                  <Link href={`/owner/disciplines/${discipline.id}/levels`} />
                }
              >
                <LayersIcon className="size-4" />
                {LEVEL_MESSAGES.MANAGE_LEVELS}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
