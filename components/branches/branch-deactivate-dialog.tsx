"use client"

import { useState } from "react"
import { AlertCircleIcon, LoaderCircleIcon, PowerOffIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  deactivateBranch,
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

interface BranchDeactivateDialogProps {
  branch: Pick<BranchRecord, "id" | "name">
}

export function BranchDeactivateDialog({
  branch,
}: BranchDeactivateDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function handleOpenChange(nextIsOpen: boolean) {
    if (isDeactivating) {
      return
    }

    setIsOpen(nextIsOpen)
    setActionError(null)
  }

  async function handleDeactivate() {
    setActionError(null)
    setIsDeactivating(true)

    try {
      const result = await deactivateBranch(branch.id)

      if (!result.success) {
        setActionError(result.error ?? "Unable to deactivate the branch.")
        return
      }

      setIsOpen(false)
      router.refresh()
    } catch {
      setActionError("Unable to deactivate the branch.")
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={<Button variant="destructive" size="sm" />}
      >
        <PowerOffIcon aria-hidden="true" />
        Deactivate
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {branch.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This branch will no longer be available in the active directory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Unable to deactivate branch</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isDeactivating && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            Deactivating branch…
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeactivating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeactivating}
            onClick={handleDeactivate}
          >
            {isDeactivating ? "Deactivating…" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
