"use client"

import { useState, useTransition } from "react"
import Link from "next/link"

import { StudentDeactivateDialog } from "@/components/students/student-deactivate-dialog"
import {
  StudentFormDialog,
  type ActiveBranchOption,
  type DisciplineOption,
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
import {
  COMMON_MESSAGES,
  STUDENT_DIRECTORY_MESSAGES,
} from "@/lib/localization/es-ec"

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
  disciplines?: DisciplineOption[]
}

export function StudentList({
  activeItems: initialActiveItems,
  activeNextCursor: initialActiveNextCursor,
  activeInitialError,
  inactiveItems: initialInactiveItems,
  inactiveNextCursor: initialInactiveNextCursor,
  inactiveInitialError,
  branches,
  disciplines,
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
          if (status === "active") setActiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
          else setInactiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
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
        if (status === "active") setActiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
        else setInactiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
      }
    })
  }

  return (
    <section aria-labelledby="students-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="students-heading" className="text-2xl font-semibold tracking-tight">
            {STUDENT_DIRECTORY_MESSAGES.HEADING}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isActiveTab
              ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_ACCOUNT_DESCRIPTION
              : STUDENT_DIRECTORY_MESSAGES.INACTIVE_ACCOUNT_DESCRIPTION}
          </p>
        </div>
        {isActiveTab && <StudentFormDialog branches={branches} disciplines={disciplines} />}
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          if (value === "active" || value === "inactive") setSelectedTab(value)
        }}
      >
        <TabsList>
          <TabsTrigger value="active">
            {STUDENT_DIRECTORY_MESSAGES.ACTIVE_TAB}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            {STUDENT_DIRECTORY_MESSAGES.HISTORY_TAB}
          </TabsTrigger>
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
          {STUDENT_DIRECTORY_MESSAGES.PAGINATION_LOADING_STATUS}
        </p>
      )}

      {items.length === 0 && !error ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
        >
          {isActiveTab
            ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_EMPTY_STATE
            : STUDENT_DIRECTORY_MESSAGES.INACTIVE_EMPTY_STATE}
        </p>
      ) : items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableCaption className="sr-only">
              {isActiveTab
                ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_TABLE_CAPTION
                : STUDENT_DIRECTORY_MESSAGES.INACTIVE_TABLE_CAPTION}
            </TableCaption>
            <TableHeader className="bg-muted/50 text-left text-muted-foreground">
              <TableRow>
                <TableHead scope="col" className="px-4 py-3">
                  {STUDENT_DIRECTORY_MESSAGES.FIRST_NAME}
                </TableHead>
                <TableHead scope="col" className="px-4 py-3">
                  {STUDENT_DIRECTORY_MESSAGES.SURNAME}
                </TableHead>
                <TableHead scope="col" className="px-4 py-3">
                  {STUDENT_DIRECTORY_MESSAGES.BRANCH_ID}
                </TableHead>
                <TableHead scope="col" className="px-4 py-3">
                  {STUDENT_DIRECTORY_MESSAGES.STATUS}
                </TableHead>
                <TableHead scope="col" className="px-4 py-3">
                  {STUDENT_DIRECTORY_MESSAGES.ACTIONS}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                      aria-label={`${STUDENT_DIRECTORY_MESSAGES.VIEW_DETAILS}: ${student.first_name} ${student.surname}`}
                    >
                      {student.first_name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3">{student.surname}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs">
                    {student.branch_id}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {isActiveTab
                      ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS
                      : STUDENT_DIRECTORY_MESSAGES.INACTIVE_STATUS}
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
            {isPending ? COMMON_MESSAGES.LOADING : STUDENT_DIRECTORY_MESSAGES.LOAD_MORE}
          </Button>
        </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
