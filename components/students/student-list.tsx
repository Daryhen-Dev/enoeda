"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"

import { getStudentColumns } from "@/components/students/student-columns"
import {
  StudentFormDialog,
  type ActiveBranchOption,
  type DisciplineOption,
} from "@/components/students/student-form-dialog"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  listStudents,
  STUDENT_STATUS,
  type StudentListInput,
  type StudentListItem,
} from "@/lib/domain/students"
import {
  COMMON_MESSAGES,
  STUDENT_DIRECTORY_MESSAGES,
} from "@/lib/localization/es-ec"

const ALL_DISCIPLINES_VALUE = "todas"

type StudentStatus = StudentListInput["status"]

interface StudentListProps {
  activeItems: StudentListItem[]
  activeNextCursor: string | null
  activeInitialError?: string
  inactiveItems: StudentListItem[]
  inactiveNextCursor: string | null
  inactiveInitialError?: string
  branches: ActiveBranchOption[]
  disciplines?: DisciplineOption[]
  lockedBranchId?: string
  branchId: string
}

export function StudentList({
  activeItems: initialActiveItems,
  activeNextCursor: initialActiveNextCursor,
  activeInitialError,
  inactiveItems: initialInactiveItems,
  inactiveNextCursor: initialInactiveNextCursor,
  inactiveInitialError,
  branches,
  disciplines = [],
  lockedBranchId,
  branchId,
}: StudentListProps) {
  const searchInputId = useId()
  const searchSuggestionsId = useId()
  const disciplineFilterId = useId()
  const [selectedTab, setSelectedTab] = useState<StudentStatus>(
    STUDENT_STATUS.ACTIVE,
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [disciplineId, setDisciplineId] = useState<string | undefined>()
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
  const requestSequence = useRef(0)
  const skipInitialLoad = useRef(true)

  const isActiveTab = selectedTab === STUDENT_STATUS.ACTIVE
  const items = isActiveTab ? activeItems : inactiveItems
  const nextCursor = isActiveTab ? activeNextCursor : inactiveNextCursor
  const error = isActiveTab ? activeError : inactiveError
  const selectedDisciplineName =
    disciplines.find((discipline) => discipline.id === disciplineId)?.name ??
    STUDENT_DIRECTORY_MESSAGES.ALL_DISCIPLINES
  const columns = getStudentColumns({
    branchId,
    branches,
    status: selectedTab,
  })

  function resetPage(status: StudentStatus) {
    if (status === STUDENT_STATUS.ACTIVE) {
      setActiveItems([])
      setActiveNextCursor(null)
      setActiveError(null)
      return
    }

    setInactiveItems([])
    setInactiveNextCursor(null)
    setInactiveError(null)
  }

  function resetAllPages() {
    resetPage(STUDENT_STATUS.ACTIVE)
    resetPage(STUDENT_STATUS.INACTIVE)
  }

  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false
      return
    }

    const timer = window.setTimeout(() => {
      const requestId = requestSequence.current + 1
      requestSequence.current = requestId
      const status = selectedTab

      startTransition(async () => {
        try {
          const result = await listStudents({
            status,
            branch_id: branchId,
            query: searchQuery,
            discipline_id: disciplineId,
          })
          const page = result.data

          if (requestId !== requestSequence.current) return

          if (!result.success || page === undefined) {
            if (status === STUDENT_STATUS.ACTIVE) {
              setActiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
            } else {
              setInactiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
            }
            return
          }

          if (status === STUDENT_STATUS.ACTIVE) {
            setActiveItems(page.items)
            setActiveNextCursor(page.next_cursor)
            setActiveError(null)
          } else {
            setInactiveItems(page.items)
            setInactiveNextCursor(page.next_cursor)
            setInactiveError(null)
          }
        } catch {
          if (requestId !== requestSequence.current) return

          if (status === STUDENT_STATUS.ACTIVE) {
            setActiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
          } else {
            setInactiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
          }
        }
      })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [branchId, disciplineId, searchQuery, selectedTab, startTransition])

  function loadMore() {
    const status = selectedTab
    const cursor =
      status === STUDENT_STATUS.ACTIVE
        ? activeNextCursor
        : inactiveNextCursor

    if (cursor === null || isPending) return

    const requestId = requestSequence.current + 1
    requestSequence.current = requestId

    startTransition(async () => {
      try {
        const result = await listStudents({
          cursor,
          status,
          branch_id: branchId,
          query: searchQuery,
          discipline_id: disciplineId,
        })
        const page = result.data

        if (requestId !== requestSequence.current) return

        if (!result.success || page === undefined) {
          if (status === STUDENT_STATUS.ACTIVE) {
            setActiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
          } else {
            setInactiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
          }
          return
        }

        if (status === STUDENT_STATUS.ACTIVE) {
          setActiveItems((currentItems) => [...currentItems, ...page.items])
          setActiveNextCursor(page.next_cursor)
          setActiveError(null)
        } else {
          setInactiveItems((currentItems) => [...currentItems, ...page.items])
          setInactiveNextCursor(page.next_cursor)
          setInactiveError(null)
        }
      } catch {
        if (requestId !== requestSequence.current) return

        if (status === STUDENT_STATUS.ACTIVE) {
          setActiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
        } else {
          setInactiveError(STUDENT_DIRECTORY_MESSAGES.LOAD_MORE_FAILURE)
        }
      }
    })
  }

  function reloadActiveStudents() {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    resetPage(STUDENT_STATUS.ACTIVE)

    startTransition(async () => {
      try {
        const result = await listStudents({
          status: STUDENT_STATUS.ACTIVE,
          branch_id: branchId,
          query: searchQuery,
          discipline_id: disciplineId,
        })
        const page = result.data

        if (requestId !== requestSequence.current) return

        if (!result.success || page === undefined) {
          setActiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
          return
        }

        setActiveItems(page.items)
        setActiveNextCursor(page.next_cursor)
        setActiveError(null)
      } catch {
        if (requestId === requestSequence.current) {
          setActiveError(STUDENT_DIRECTORY_MESSAGES.INITIAL_LOAD_FAILURE)
        }
      }
    })
  }

  function handleSearchChange(value: string) {
    requestSequence.current += 1
    resetAllPages()
    setSearchQuery(value)
  }

  function handleDisciplineChange(value: string | null) {
    requestSequence.current += 1
    resetAllPages()
    setDisciplineId(value === ALL_DISCIPLINES_VALUE ? undefined : value ?? undefined)
  }

  function handleTabChange(value: string) {
    if (value !== STUDENT_STATUS.ACTIVE && value !== STUDENT_STATUS.INACTIVE) {
      return
    }

    if (value === selectedTab) return

    requestSequence.current += 1
    resetPage(value)
    setSelectedTab(value)
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
        {isActiveTab && (
          <StudentFormDialog
            branches={branches}
            disciplines={disciplines}
            lockedBranchId={lockedBranchId}
            branchId={branchId}
            onCreated={reloadActiveStudents}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={searchInputId}>
            {STUDENT_DIRECTORY_MESSAGES.SEARCH_LABEL}
          </Label>
          <Input
            id={searchInputId}
            list={searchSuggestionsId}
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={STUDENT_DIRECTORY_MESSAGES.SEARCH_PLACEHOLDER}
          />
          <datalist id={searchSuggestionsId}>
            {items.map((student) => (
              <option
                key={student.id}
                value={`${student.first_name} ${student.surname}`}
              />
            ))}
          </datalist>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:max-w-xs">
          <Label htmlFor={disciplineFilterId}>
            {STUDENT_DIRECTORY_MESSAGES.DISCIPLINE_FILTER_LABEL}
          </Label>
          <Select
            value={disciplineId ?? ALL_DISCIPLINES_VALUE}
            onValueChange={handleDisciplineChange}
          >
            <SelectTrigger id={disciplineFilterId} className="w-full">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {selectedDisciplineName}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DISCIPLINES_VALUE}>
                {STUDENT_DIRECTORY_MESSAGES.ALL_DISCIPLINES}
              </SelectItem>
              {disciplines.map((discipline) => (
                <SelectItem key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value={STUDENT_STATUS.ACTIVE}>
            {STUDENT_DIRECTORY_MESSAGES.ACTIVE_TAB}
          </TabsTrigger>
          <TabsTrigger value={STUDENT_STATUS.INACTIVE}>
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

          {!error && (
            <DataTable
              columns={columns}
              data={items}
              caption={
                isActiveTab
                  ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_TABLE_CAPTION
                  : STUDENT_DIRECTORY_MESSAGES.INACTIVE_TABLE_CAPTION
              }
              emptyState={
                isActiveTab
                  ? STUDENT_DIRECTORY_MESSAGES.ACTIVE_EMPTY_STATE
                  : STUDENT_DIRECTORY_MESSAGES.INACTIVE_EMPTY_STATE
              }
            />
          )}

          {nextCursor !== null && !error && (
            <div>
              <Button type="button" onClick={loadMore} disabled={isPending}>
                {isPending
                  ? COMMON_MESSAGES.LOADING
                  : STUDENT_DIRECTORY_MESSAGES.LOAD_MORE}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
