"use client"

import { useState } from "react"
import { AlertCircleIcon, LoaderCircleIcon, RotateCcwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
import { COMMON_MESSAGES, PRODUCT_TERMS, TOAST_MESSAGES } from "@/lib/localization/es-ec"

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
        setActionError(
          result.error ?? `No se pudo reactivar la ${PRODUCT_TERMS.BRANCH.toLowerCase()}.`
        )
        return
      }

      setIsOpen(false)
      toast.success(TOAST_MESSAGES.BRANCH_REACTIVATED)
      router.refresh()
    } catch {
      setActionError(
        `No se pudo reactivar la ${PRODUCT_TERMS.BRANCH.toLowerCase()}.`
      )
    } finally {
      setIsReactivating(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        <RotateCcwIcon aria-hidden="true" />
        Reactivar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reactivar {branch.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta {PRODUCT_TERMS.BRANCH.toLowerCase()} volverá al directorio activo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se pudo reactivar la {PRODUCT_TERMS.BRANCH.toLowerCase()}</AlertTitle>
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
            Reactivando sucursal…
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReactivating}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isReactivating}
            onClick={handleReactivate}
          >
            {isReactivating ? "Reactivando…" : "Reactivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
