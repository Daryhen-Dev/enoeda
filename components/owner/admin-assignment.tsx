"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { assignBranchAdmin, revokeBranchRole } from "@/lib/domain/roles/actions"
import type { StaffAssignment } from "@/lib/domain/roles/actions"
import { OWNER_MESSAGES, COMMON_MESSAGES, formatDate } from "@/lib/localization/es-ec"

interface AdminAssignmentProps {
  branchId: string
  admins: StaffAssignment[]
}

export function AdminAssignment({ branchId, admins }: AdminAssignmentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {OWNER_MESSAGES.ADMINS_TITLE}
          </h3>
          <p className="text-sm text-muted-foreground">
            {OWNER_MESSAGES.ADMINS_DESCRIPTION}
          </p>
        </div>
        <AssignAdminDialog branchId={branchId} />
      </div>

      {admins.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{OWNER_MESSAGES.ADMINS_EMPTY}</EmptyTitle>
            <EmptyDescription>
              {OWNER_MESSAGES.ADMINS_EMPTY_DESCRIPTION}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <AdminTable branchId={branchId} admins={admins} />
      )}
    </div>
  )
}

function AdminTable({
  branchId,
  admins,
}: {
  branchId: string
  admins: StaffAssignment[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{OWNER_MESSAGES.USER_ID}</TableHead>
          <TableHead>{OWNER_MESSAGES.ASSIGNED_AT}</TableHead>
          <TableHead>{OWNER_MESSAGES.ACTIONS}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {admins.map((admin) => (
          <TableRow key={admin.user_id}>
            <TableCell className="font-mono text-xs">
              {admin.user_id}
            </TableCell>
            <TableCell>
              {formatDate(new Date(admin.assigned_at))}
            </TableCell>
            <TableCell>
              <RevokeAdminDialog
                branchId={branchId}
                userId={admin.user_id}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AssignAdminDialog({ branchId }: { branchId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setTargetUserId("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await assignBranchAdmin({
        targetUserId,
        branchId,
      })
      if (result.success) {
        setOpen(false)
        resetForm()
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger render={<Button variant="default" size="default" />}>
        <PlusIcon data-icon="inline-start" />
        {OWNER_MESSAGES.ASSIGN_ADMIN}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{OWNER_MESSAGES.ASSIGN_ADMIN_TITLE}</DialogTitle>
            <DialogDescription>
              {OWNER_MESSAGES.ASSIGN_ADMIN_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="mt-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="admin-user-id">
                {OWNER_MESSAGES.USER_ID}
              </FieldLabel>
              <Input
                id="admin-user-id"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                aria-describedby={error ? "assign-admin-error" : undefined}
                aria-invalid={Boolean(error)}
                required
              />
            </Field>
            {error && (
              <FieldError id="assign-admin-error">{error}</FieldError>
            )}
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button
              type="submit"
              disabled={isPending || !targetUserId}
            >
              {isPending ? COMMON_MESSAGES.LOADING : OWNER_MESSAGES.ASSIGN_ADMIN}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RevokeAdminDialog({
  branchId,
  userId,
}: {
  branchId: string
  userId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeBranchRole({
        targetUserId: userId,
        role: "admin",
        branchId,
      })
      if (result.success) {
        setError(null)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="xs" />}>
        {OWNER_MESSAGES.REVOKE_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {OWNER_MESSAGES.REVOKE_ADMIN_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {OWNER_MESSAGES.REVOKE_ADMIN_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{OWNER_MESSAGES.REVOKE_ERROR}</AlertTitle>
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
            onClick={handleRevoke}
          >
            {isPending ? COMMON_MESSAGES.LOADING : OWNER_MESSAGES.REVOKE_ACTION}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
