"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BuildingIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { BranchDetail } from "@/components/owner/branch-detail"
import { deleteBranch } from "@/lib/domain/branches/actions"
import type { BranchRecord } from "@/lib/domain/branches/actions"
import { COMMON_MESSAGES, OWNER_MESSAGES, TOAST_MESSAGES } from "@/lib/localization/es-ec"

interface BranchListProps {
  branches: BranchRecord[]
}

export function BranchList({ branches }: BranchListProps) {
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null)

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
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{OWNER_MESSAGES.ACTIONS}</TableHead>
            <TableHead>{OWNER_MESSAGES.BRANCH_NAME}</TableHead>
            <TableHead>{OWNER_MESSAGES.BRANCH_ADDRESS}</TableHead>
            <TableHead>{OWNER_MESSAGES.BRANCH_PHONE}</TableHead>
            <TableHead>{OWNER_MESSAGES.BRANCH_STATUS}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {branches.map((branch) => (
            <TableRow key={branch.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setEditingBranch(branch)}
                    aria-label={OWNER_MESSAGES.EDIT_BRANCH}
                    title={OWNER_MESSAGES.EDIT_BRANCH}
                  >
                    <PencilIcon />
                  </Button>
                  <DeleteBranchAction branch={branch} />
                </div>
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/owner/branches/${branch.id}/admins`}
                  className="flex items-center gap-2 hover:underline"
                  title={OWNER_MESSAGES.ADMINS_TITLE}
                >
                  <BuildingIcon className="size-4 text-muted-foreground" />
                  {branch.name}
                </Link>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingBranch && (
        <BranchDetail
          branch={editingBranch}
          open={editingBranch !== null}
          onOpenChange={(open) => {
            if (!open) setEditingBranch(null)
          }}
        />
      )}
    </>
  )
}

function DeleteBranchAction({ branch }: { branch: BranchRecord }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBranch(branch.id)
      if (result.success) {
        setError(null)
        toast.success(TOAST_MESSAGES.BRANCH_DELETED)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={OWNER_MESSAGES.DELETE_ACTION}
            title={OWNER_MESSAGES.DELETE_ACTION}
          />
        }
      >
        <Trash2Icon className="text-destructive" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {OWNER_MESSAGES.DELETE_CONFIRMATION_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {OWNER_MESSAGES.DELETE_CONFIRMATION_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{OWNER_MESSAGES.DELETE_ERROR}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? COMMON_MESSAGES.LOADING : OWNER_MESSAGES.DELETE_ACTION}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
