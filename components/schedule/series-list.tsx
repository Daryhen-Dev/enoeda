"use client"

import { useMemo, useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PencilIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  cloneClassGroupToNextMonth,
  deactivateAllFutureClasses,
  deactivateScheduledClassSeries,
  renameClassSeries,
  type ClassSeriesView,
  type CloneClassGroupResult,
} from "@/lib/domain/classes/actions"
import {
  RosterEditorSheet,
  ROSTER_SKIP_REASON_LABELS,
} from "@/components/rosters/roster-editor-sheet"
import { ScheduledClassCreateDialog } from "@/components/classes/scheduled-class-create-dialog"
import {
  CLASS_MESSAGES,
  CLONE_MESSAGES,
  COMMON_MESSAGES,
  SCHEDULE_SERIES_MESSAGES,
  WEEKDAY_LABELS,
} from "@/lib/localization/es-ec"

interface SeriesListProps {
  branchId: string
  series: ClassSeriesView[]
  disciplines: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; name: string }>
}

const SERIES_NAME_MAX_LENGTH = 80

const ALL_MONTHS_VALUE = "__all__"

/** "YYYY-MM" → es-EC display label, e.g. "Septiembre de 2026". */
function formatMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number)
  const rawLabel = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
}

/** "YYYY-MM" → the NEXT month as "YYYY-MM" (Dec → Jan of the next year). */
function getNextMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number)
  const date = new Date(Date.UTC(year, month, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Current "YYYY-MM" in America/Guayaquil (the branch's time zone). */
function getCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Guayaquil",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  return year && month ? `${year}-${month}` : ""
}

function formatDays(daysOfWeek: number[]): string {
  return daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(", ")
}

/**
 * Concurrencias section — admin list of the branch's monthly class groups
 * (class_series) with a month filter, rename, per-group removal and the
 * destructive "remove ALL future" action. Removal is soft
 * (is_active=false on the group and its weekday rows); history is never
 * deleted.
 */
export function SeriesList({ branchId, series, disciplines, teachers }: SeriesListProps) {
  // Default filter: the CURRENT month in America/Guayaquil; "Todos" lifts it.
  const [monthFilter, setMonthFilter] = useState(() => getCurrentMonth())
  const monthOptions = useMemo(
    () => [...new Set(series.map((item) => item.period_month))].sort(),
    [series]
  )
  const visibleSeries =
    monthFilter === ALL_MONTHS_VALUE
      ? series
      : series.filter((item) => item.period_month === monthFilter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{SCHEDULE_SERIES_MESSAGES.PAGE_TITLE}</h2>
        <ScheduledClassCreateDialog
          branchId={branchId}
          disciplines={disciplines}
          teachers={teachers}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Field>
          <FieldLabel htmlFor="series-month-filter">
            {SCHEDULE_SERIES_MESSAGES.MONTH_FILTER_LABEL}
          </FieldLabel>
          <Select
            value={monthFilter}
            onValueChange={(value) => {
              if (value) setMonthFilter(value)
            }}
            items={[
              { value: ALL_MONTHS_VALUE, label: SCHEDULE_SERIES_MESSAGES.MONTH_FILTER_ALL },
              ...monthOptions.map((month) => ({ value: month, label: formatMonth(month) })),
            ]}
          >
            <SelectTrigger id="series-month-filter" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS_VALUE}>
                {SCHEDULE_SERIES_MESSAGES.MONTH_FILTER_ALL}
              </SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <RemoveAllFutureAction branchId={branchId} disabled={series.length === 0} />
      </div>
      {visibleSeries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{SCHEDULE_SERIES_MESSAGES.EMPTY_STATE}</EmptyTitle>
            <EmptyDescription>{SCHEDULE_SERIES_MESSAGES.PAGE_DESCRIPTION}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.NAME_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.DISCIPLINE_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.MONTH_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.DAYS_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.TIME_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.TEACHER_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.CLASSES_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.STATE_LABEL}</TableHead>
              <TableHead>{SCHEDULE_SERIES_MESSAGES.ACTIONS_LABEL}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSeries.map((item) => (
              <TableRow key={item.series_id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.discipline_name}</TableCell>
                <TableCell>{formatMonth(item.period_month)}</TableCell>
                <TableCell>{formatDays(item.days_of_week)}</TableCell>
                <TableCell>{item.start_time}</TableCell>
                <TableCell>
                  {item.teacher_name ?? SCHEDULE_SERIES_MESSAGES.NO_TEACHER}
                </TableCell>
                <TableCell>{item.active_row_count}</TableCell>
                <TableCell>
                  {item.is_all_inactive ? (
                    <Badge variant="outline">
                      {SCHEDULE_SERIES_MESSAGES.ALL_INACTIVE_LABEL}
                    </Badge>
                  ) : (
                    <Badge>{SCHEDULE_SERIES_MESSAGES.ACTIVE_LABEL}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <SeriesRosterAction branchId={branchId} series={item} />
                    <CloneSeriesAction branchId={branchId} series={item} />
                    <RenameSeriesAction
                      branchId={branchId}
                      seriesId={item.series_id}
                      currentName={item.name}
                    />
                    <RemoveSeriesAction
                      branchId={branchId}
                      seriesId={item.series_id}
                      disabled={item.is_all_inactive}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/**
 * Opens the roster editor for one monthly group. The editor is admin-only
 * UI: this section renders behind the page's canManage gate and every
 * action re-asserts authorization server-side.
 */
function SeriesRosterAction({
  branchId,
  series,
}: {
  branchId: string
  series: ClassSeriesView
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        aria-label={SCHEDULE_SERIES_MESSAGES.ROSTER_BUTTON_ARIA_LABEL(
          series.name,
          series.roster_student_count
        )}
        onClick={() => setOpen(true)}
      >
        <UsersIcon aria-hidden="true" data-icon="inline-start" />
        {`${SCHEDULE_SERIES_MESSAGES.ROSTER_ACTION} (${series.roster_student_count})`}
      </Button>
      <RosterEditorSheet
        branchId={branchId}
        target={{ kind: "series", series_id: series.series_id }}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/**
 * "Clonar al mes siguiente" — copies the group (days, times, teacher and
 * eligible roster) into the next month. Disabled when the group is
 * inactive or was already cloned (clone-once flow). On success a toast
 * reports the copied counts; skipped students open a follow-up dialog
 * with a shortcut to edit the new group's roster.
 */
function CloneSeriesAction({
  branchId,
  series,
}: {
  branchId: string
  series: ClassSeriesView
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloneResult, setCloneResult] = useState<CloneClassGroupResult | null>(null)
  const [newSeriesId, setNewSeriesId] = useState<string | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sourceMonth = formatMonth(series.period_month)
  const targetMonth = formatMonth(getNextMonth(series.period_month))
  const cloneDisabled = !series.is_active || series.is_all_inactive || series.has_clone

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    setOpen(nextOpen)
    setError(null)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await cloneClassGroupToNextMonth({
        branch_id: branchId,
        series_id: series.series_id,
      })
      if (!result.success || !result.data) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        return
      }
      setOpen(false)
      setNewSeriesId(result.data.series_id)
      toast.success(
        CLONE_MESSAGES.SUCCESS_SUMMARY(
          result.data.period_month,
          result.data.copied_student_count,
          result.data.skipped.length
        )
      )
      if (result.data.skipped.length > 0) {
        setCloneResult(result.data)
      } else {
        router.refresh()
      }
    })
  }

  function closeSkippedDialog() {
    setCloneResult(null)
    router.refresh()
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger
          disabled={cloneDisabled}
          render={<Button variant="outline" size="xs" />}
        >
          {SCHEDULE_SERIES_MESSAGES.CLONE_ACTION}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {SCHEDULE_SERIES_MESSAGES.CLONE_TITLE}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {SCHEDULE_SERIES_MESSAGES.CLONE_DESCRIPTION(
                series.name,
                sourceMonth,
                targetMonth
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {COMMON_MESSAGES.CANCEL}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
              {isPending
                ? COMMON_MESSAGES.LOADING
                : SCHEDULE_SERIES_MESSAGES.CLONE_CONFIRM}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={cloneResult !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && cloneResult) closeSkippedDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{SCHEDULE_SERIES_MESSAGES.SKIPPED_TITLE}</DialogTitle>
            <DialogDescription>
              {SCHEDULE_SERIES_MESSAGES.SKIPPED_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>
          {cloneResult && (
            <ul aria-live="polite" className="flex flex-col gap-1 text-sm">
              {cloneResult.skipped.map((student) => (
                <li key={student.student_id}>
                  <span className="font-medium">
                    {student.first_name} {student.surname}
                  </span>
                  {": "}
                  <span className="text-muted-foreground">
                    {ROSTER_SKIP_REASON_LABELS[student.reason]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSkippedDialog}>
              {SCHEDULE_SERIES_MESSAGES.SKIPPED_CLOSE}
            </Button>
            <Button
              onClick={() => {
                setCloneResult(null)
                setRosterOpen(true)
              }}
            >
              {SCHEDULE_SERIES_MESSAGES.EDIT_NEW_GROUP_ACTION}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {newSeriesId && (
        <RosterEditorSheet
          branchId={branchId}
          target={{ kind: "series", series_id: newSeriesId }}
          open={rosterOpen}
          onOpenChange={(nextOpen) => {
            setRosterOpen(nextOpen)
            if (!nextOpen) router.refresh()
          }}
        />
      )}
    </>
  )
}

function RenameSeriesAction({
  branchId,
  seriesId,
  currentName,
}: {
  branchId: string
  seriesId: string
  currentName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    setOpen(nextOpen)
    if (nextOpen) {
      setName(currentName)
      setError(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(CLASS_MESSAGES.SERIES_NAME_REQUIRED)
      return
    }
    if (trimmed.length > SERIES_NAME_MAX_LENGTH) {
      setError(CLASS_MESSAGES.SERIES_NAME_MAX)
      return
    }

    startTransition(async () => {
      const result = await renameClassSeries({
        branch_id: branchId,
        series_id: seriesId,
        name: trimmed,
      })
      if (result.success) {
        setOpen(false)
        toast.success(SCHEDULE_SERIES_MESSAGES.RENAME_SUCCESS)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="xs"
        aria-label={SCHEDULE_SERIES_MESSAGES.RENAME_ACTION}
        onClick={() => handleOpenChange(true)}
      >
        <PencilIcon aria-hidden="true" data-icon="inline-start" />
        {SCHEDULE_SERIES_MESSAGES.RENAME_ACTION}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{SCHEDULE_SERIES_MESSAGES.RENAME_TITLE}</DialogTitle>
          <DialogDescription>
            {SCHEDULE_SERIES_MESSAGES.RENAME_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={`series-name-${seriesId}`}>
              {SCHEDULE_SERIES_MESSAGES.NAME_LABEL}
            </FieldLabel>
            <Input
              id={`series-name-${seriesId}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={SERIES_NAME_MAX_LENGTH}
              disabled={isPending}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
              {COMMON_MESSAGES.CANCEL}
            </Button>
            <Button type="submit" disabled={isPending || name.trim().length === 0}>
              {isPending ? COMMON_MESSAGES.LOADING : SCHEDULE_SERIES_MESSAGES.RENAME_SAVE}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveSeriesAction({
  branchId,
  seriesId,
  disabled,
}: {
  branchId: string
  seriesId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    setOpen(nextOpen)
    setError(null)
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deactivateScheduledClassSeries({
        branch_id: branchId,
        series_id: seriesId,
      })
      if (result.success) {
        setOpen(false)
        toast.success(SCHEDULE_SERIES_MESSAGES.REMOVE_SERIES_SUCCESS)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="destructive" size="xs" />}
      >
        {SCHEDULE_SERIES_MESSAGES.REMOVE_SERIES_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {SCHEDULE_SERIES_MESSAGES.REMOVE_SERIES_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {SCHEDULE_SERIES_MESSAGES.REMOVE_SERIES_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? COMMON_MESSAGES.LOADING
              : SCHEDULE_SERIES_MESSAGES.REMOVE_SERIES_CONFIRM}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RemoveAllFutureAction({
  branchId,
  disabled,
}: {
  branchId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    setOpen(nextOpen)
    setError(null)
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deactivateAllFutureClasses({
        branch_id: branchId,
      })
      if (result.success) {
        setOpen(false)
        toast.success(SCHEDULE_SERIES_MESSAGES.REMOVE_ALL_SUCCESS)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="destructive" size="sm" />}
      >
        <TriangleAlertIcon aria-hidden="true" data-icon="inline-start" />
        {SCHEDULE_SERIES_MESSAGES.REMOVE_ALL_ACTION}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {SCHEDULE_SERIES_MESSAGES.REMOVE_ALL_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {SCHEDULE_SERIES_MESSAGES.REMOVE_ALL_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? COMMON_MESSAGES.LOADING
              : SCHEDULE_SERIES_MESSAGES.REMOVE_ALL_CONFIRM}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
