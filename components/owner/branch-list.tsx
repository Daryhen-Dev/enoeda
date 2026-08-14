"use client"

import Link from "next/link"
import { BuildingIcon } from "lucide-react"

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
import type { BranchRecord } from "@/lib/domain/branches/actions"
import { OWNER_MESSAGES } from "@/lib/localization/es-ec"

interface BranchListProps {
  branches: BranchRecord[]
}

export function BranchList({ branches }: BranchListProps) {
  if (branches.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{OWNER_MESSAGES.BRANCHES_EMPTY}</EmptyTitle>
          <EmptyDescription>
            {OWNER_MESSAGES.BRANCHES_EMPTY_DESCRIPTION}
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
          <TableHead>{OWNER_MESSAGES.BRANCH_ADDRESS}</TableHead>
          <TableHead>{OWNER_MESSAGES.BRANCH_PHONE}</TableHead>
          <TableHead>{OWNER_MESSAGES.BRANCH_STATUS}</TableHead>
          <TableHead>{OWNER_MESSAGES.ACTIONS}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {branches.map((branch) => (
          <TableRow key={branch.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <BuildingIcon className="size-4 text-muted-foreground" />
                {branch.name}
              </div>
            </TableCell>
            <TableCell>{branch.address ?? "—"}</TableCell>
            <TableCell>{branch.phone ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={branch.is_active ? "default" : "secondary"}>
                {branch.is_active
                  ? OWNER_MESSAGES.STATUS_ACTIVE
                  : OWNER_MESSAGES.STATUS_INACTIVE}
              </Badge>
            </TableCell>
            <TableCell>
              <Link
                href={`/owner/branches/${branch.id}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {OWNER_MESSAGES.MANAGE}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
