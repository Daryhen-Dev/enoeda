"use client"

import { useState, useTransition } from "react"

import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import {
  StudentFormDialog,
  type ActiveBranchOption,
} from "@/components/students/student-form-dialog"
import { StudentReactivateDialog } from "@/components/students/student-reactivate-dialog"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listStudents,
  type StudentListInput,
  type StudentListItem,
} from "@/lib/domain/students"

const GENERIC_LOAD_ERROR = "Unable to load more students. Please try again."

type StudentStatus = StudentListInput["status"]
type StudentSummary = Pick<
  StudentListItem,
  "id" | "first_name" | "surname" | "branch_id"
>

interface StudentListProps {
  activeItems: StudentSummary[]
  activeNextCursor: string | null
  activeInitialError?: string
  inactiveItems: StudentSummary[]
  inactiveNextCursor: string | null
  inactiveInitialError?: string
  branches: ActiveBranchOption[]
}

export function StudentList({
  activeItems: initialActiveItems,
  activeNextCursor: initialActiveNextCursor,
  activeInitialError,
  inactiveItems: initialInactiveItems,
  inactiveNextCursor: initialInactiveNextCursor,
  inactiveInitialError,
  branches,
}: StudentListProps) {
  const [selectedTab, setSelectedTab] = useState<StudentStatus>("active")
  const [activeItems, setActiveItems] = useState(initialActiveItems)
  const [activeNextCursor, setActiveNextCursor] = useState(
    initialActiveNextCursor,
  )
  const [activeError, setActiveError] = useState(activeInitialError ?? null)
  const [inactiveItems, setInactiveItems] = useState(initialInactiveItems)
  const [inactiveNextCursor, setInactiveNextCursor] = useState(
    initialInactiveNextCursor,
  )
  const [inactiveError, setInactiveError] = useState(
    inactiveInitialError ?? null,
  )
  const [isPending, startTransition] = useTransition()

  const isActiveTab = selectedTab === "active"
  const items = isActiveTab ? activeItems : inactiveItems
  const nextCursor = isActiveTab ? activeNextCursor : inactiveNextCursor
  const error = isActiveTab ? activeError : inactiveError

  function loadMore() {
    const status = selectedTab
    const cursor = status === "active" ? activeNextCursor : inactiveNextCursor

    if (cursor === null || isPending) return

    startTransition(async () => {
      try {
        const result = await listStudents({ cursor, status })
        const page = result.data

        if (!result.success || page === undefined) {
          if (status === "active") setActiveError(GENERIC_LOAD_ERROR)
          else setInactiveError(GENERIC_LOAD_ERROR)
          return
        }

        const loadedItems = page.items

        if (status === "active") {
          setActiveItems((currentItems) => [...currentItems, ...loadedItems])
          setActiveNextCursor(page.next_cursor)
          setActiveError(null)
        } else {
          setInactiveItems((currentItems) => [...currentItems, ...loadedItems])
          setInactiveNextCursor(page.next_cursor)
          setInactiveError(null)
        }
      } catch {
        if (status === "active") setActiveError(GENERIC_LOAD_ERROR)
        else setInactiveError(GENERIC_LOAD_ERROR)
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
            {isActiveTab
              ? "Active student records available to your account."
              : "Inactive student records available to your account."}
          </p>
        </div>
        {isActiveTab && <StudentFormDialog branches={branches} />}
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          if (value === "active" || value === "inactive") setSelectedTab(value)
        }}
      >
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">History</TabsTrigger>
        </TabsList>
        <TabsContent value={selectedTab} className="flex flex-col gap-4">
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

      {items.length === 0 && !error ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No {selectedTab} students found.
        </p>
      ) : items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableCaption className="sr-only">
              {isActiveTab ? "Active students" : "Inactive students"}
            </TableCaption>
            <TableHeader className="bg-muted/50 text-left text-muted-foreground">
              <TableRow>
                <TableHead scope="col" className="px-4 py-3">First name</TableHead>
                <TableHead scope="col" className="px-4 py-3">Surname</TableHead>
                <TableHead scope="col" className="px-4 py-3">Branch ID</TableHead>
                <TableHead scope="col" className="px-4 py-3">Status</TableHead>
                <TableHead scope="col" className="px-4 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="px-4 py-3">{student.first_name}</TableCell>
                  <TableCell className="px-4 py-3">{student.surname}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs">
                    {student.branch_id}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {isActiveTab ? "Active" : "Inactive"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {isActiveTab ? (
                      <div className="flex flex-wrap gap-2">
                        <StudentFormDialog branches={branches} studentId={student.id} />
                        <StudentDeactivateDialog
                          student={{
                            id: student.id,
                            first_name: student.first_name,
                            surname: student.surname,
                          }}
                        />
                      </div>
                    ) : (
                      <StudentReactivateDialog
                        student={{ id: student.id, branch_id: student.branch_id }}
                        branches={branches}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {nextCursor !== null && (
        <div>
          <Button type="button" onClick={loadMore} disabled={isPending}>
            {isPending ? "Loading..." : "Load more"}
          </Button>
        </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
