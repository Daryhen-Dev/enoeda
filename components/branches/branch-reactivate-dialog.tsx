"use client"

import { useState } from "react"
import { AlertCircleIcon, LoaderCircleIcon, RotateCcwIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  reactivateBranch,
  type BranchRecord,
} from "@/lib/domain/branches/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"

interface BranchReactivateDialogProps {
  branch: Pick<BranchRecord, "id" | "name">
}

export function BranchReactivateDialog({
  branch,
}: BranchReactivateDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function handleOpenChange(nextIsOpen: boolean) {
    if (isReactivating) {
      return
    }

    setIsOpen(nextIsOpen)
    setActionError(null)
  }

  async function handleReactivate() {
    setActionError(null)
    setIsReactivating(true)

    try {
      const result = await reactivateBranch(branch.id)

      if (!result.success) {
        setActionError(result.error ?? "Unable to reactivate the branch.")
        return
      }

      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError("Unable to reactivate the branch.")
    } finally {
      setIsReactivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        <RotateCcwIcon aria-hidden="true" />
        Reactivate
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {branch.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This branch will return to the active directory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Unable to reactivate branch</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isReactivating && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            Reactivating branch…
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReactivating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isReactivating}
            onClick={handleReactivate}
          >
            {isReactivating ? "Reactivating…" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
