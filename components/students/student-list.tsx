"use client"

import { useState, useTransition } from "react"

import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import {
  StudentFormDialog,
  type ActiveBranchOption,
} from "@/components/students/student-form-dialog"
import { Button } from "@/components/ui/button"
import { listStudents, type StudentListItem } from "@/lib/domain/students/actions"

const GENERIC_LOAD_ERROR = "Unable to load more students. Please try again."

type StudentSummary = Pick<
  StudentListItem,
  "id" | "first_name" | "surname" | "branch_id" | "is_active"
>

interface StudentListProps {
  items: StudentSummary[]
  nextCursor: string | null
  initialError?: string
  branches: ActiveBranchOption[]
}

function projectStudent(student: StudentSummary): StudentSummary {
  return {
    id: student.id,
    first_name: student.first_name,
    surname: student.surname,
    branch_id: student.branch_id,
    is_active: student.is_active,
  }
}

export function StudentList({
  items: initialItems,
  nextCursor: initialNextCursor,
  initialError,
  branches,
}: StudentListProps) {
  const [items, setItems] = useState(() => initialItems.map(projectStudent))
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [error, setError] = useState(initialError ?? null)
  const [isPending, startTransition] = useTransition()

  function loadMore() {
    if (nextCursor === null || isPending) return

    startTransition(async () => {
      try {
        const result = await listStudents({ cursor: nextCursor })
        const page = result.data

        if (!result.success || page === undefined) {
          setError(GENERIC_LOAD_ERROR)
          return
        }

        const loadedItems = page.items.map(projectStudent)

        setItems((currentItems) => [...currentItems, ...loadedItems])
        setNextCursor(page.next_cursor)
        setError(null)
      } catch {
        setError(GENERIC_LOAD_ERROR)
      }
    })
  }

  return (
    <section aria-labelledby="students-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="students-heading" className="text-2xl font-semibold tracking-tight">
            Students
          </h1>
          <p className="text-sm text-muted-foreground">
            Active student records available to your account.
          </p>
        </div>
        <StudentFormDialog branches={branches} />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isPending && (
        <p role="status" aria-live="polite" className="sr-only">
          Loading more students.
        </p>
      )}

      {items.length === 0 && !initialError ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No students found.
        </p>
      ) : items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Active students</caption>
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  First name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Surname
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch ID
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((student) => (
                <tr key={student.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3">{student.first_name}</td>
                  <td className="px-4 py-3">{student.surname}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {student.branch_id}
                  </td>
                  <td className="px-4 py-3">
                    {student.is_active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3">
                    {student.is_active && (
                      <div className="flex flex-wrap gap-2">
                        <StudentFormDialog branches={branches} studentId={student.id} />
                        <StudentDeactivateDialog student={student} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {nextCursor !== null && (
        <div>
          <Button type="button" onClick={loadMore} disabled={isPending}>
            {isPending ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </section>
  )
}
