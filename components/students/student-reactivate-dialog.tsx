"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"

import type { ActiveBranchOption } from "@/components/students/student-form-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { reactivateStudent } from "@/lib/domain/students"

interface ReactivateStudentSummary {
  id: string
  branch_id: string
}

interface StudentReactivateDialogProps {
  student: ReactivateStudentSummary
  branches: ActiveBranchOption[]
}

export function StudentReactivateDialog({
  student,
  branches,
}: StudentReactivateDialogProps) {
  const router = useRouter()
  const branchSelectId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [branchId, setBranchId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const requiresBranch = !branches.some((branch) => branch.id === student.branch_id)

  function setDialogOpen(open: boolean) {
    if (isPending) return
    setIsOpen(open)
    setBranchId("")
    setError(null)
  }

  async function handleReactivate() {
    if (requiresBranch && !branchId) {
      setError("Select an active branch to reactivate this student.")
      return
    }

    setError(null)
    setIsPending(true)
    try {
      const result = await reactivateStudent({
        id: student.id,
        ...(requiresBranch ? { branch_id: branchId } : {}),
      })
      if (!result.success) {
        setError(result.error ?? "Unable to reactivate the student.")
        return
      }
      setIsOpen(false)
      router.refresh()
    } catch {
      setError("Unable to reactivate the student.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>Reactivate</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate student?</AlertDialogTitle>
          <AlertDialogDescription>This student will return to the active list.</AlertDialogDescription>
        </AlertDialogHeader>
        {requiresBranch && (
          <Field>
            <FieldLabel htmlFor={branchSelectId}>Active branch</FieldLabel>
            <Select value={branchId} onValueChange={(value) => setBranchId(value ?? "")} disabled={isPending}>
              <SelectTrigger id={branchSelectId} className="w-full"><SelectValue placeholder="Select an active branch" /></SelectTrigger>
              <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {isPending && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Reactivating student...</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleReactivate}>{isPending ? "Reactivating..." : "Reactivate"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
