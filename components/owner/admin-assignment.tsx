"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
import { CreatedAccountDialog } from "@/components/owner/created-account-dialog"
import { createBranchAdmin, revokeBranchRole } from "@/lib/domain/roles/actions"
import type {
  CreatedAccountCredentials,
  StaffAssignment,
} from "@/lib/domain/roles/actions"
import {
  OWNER_MESSAGES,
  COMMON_MESSAGES,
  ROLE_CREATION_MESSAGES,
  TOAST_MESSAGES,
  formatDate,
} from "@/lib/localization/es-ec"

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
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedAccountCredentials | null>(null)

  function resetForm() {
    setEmail("")
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createBranchAdmin({ email, branchId })
      if (result.success && result.data) {
        setOpen(false)
        resetForm()
        setCreatedCredentials(result.data)
        toast.success(TOAST_MESSAGES.ADMIN_ACCOUNT_CREATED)
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) resetForm()
        }}
      >
        <SheetTrigger render={<Button variant="default" size="default" />}>
          <PlusIcon data-icon="inline-start" />
          {OWNER_MESSAGES.ASSIGN_ADMIN}
        </SheetTrigger>
        <SheetContent side="right" size="content">
          <SheetHeader>
            <SheetTitle>{OWNER_MESSAGES.ASSIGN_ADMIN_TITLE}</SheetTitle>
            <SheetDescription>
              {OWNER_MESSAGES.ASSIGN_ADMIN_DESCRIPTION}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="admin-email">
                  {ROLE_CREATION_MESSAGES.EMAIL_LABEL}
                </FieldLabel>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder={ROLE_CREATION_MESSAGES.EMAIL_PLACEHOLDER}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? "assign-admin-error" : undefined}
                  aria-invalid={Boolean(error)}
                  required
                />
              </Field>
              {error && (
                <FieldError id="assign-admin-error">{error}</FieldError>
              )}
            </FieldGroup>

            <Button type="submit" disabled={isPending || !email} className="self-start">
              {isPending
                ? ROLE_CREATION_MESSAGES.CREATING_ACCOUNT
                : ROLE_CREATION_MESSAGES.CREATE_ACCOUNT_ACTION}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <CreatedAccountDialog
        credentials={createdCredentials}
        onClose={() => {
          setCreatedCredentials(null)
          router.refresh()
        }}
      />
    </>
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
        toast.success(TOAST_MESSAGES.ADMIN_REVOKED)
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
