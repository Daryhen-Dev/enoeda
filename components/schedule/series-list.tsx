"use client"

import { useMemo, useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PencilIcon, TriangleAlertIcon } from "lucide-react"

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
  deactivateAllFutureClasses,
  deactivateScheduledClassSeries,
  renameClassSeries,
  type ClassSeriesView,
} from "@/lib/domain/classes/actions"
import { ScheduledClassCreateDialog } from "@/components/classes/scheduled-class-create-dialog"
import {
  CLASS_MESSAGES,
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
  const [monthFilter, setMonthFilter] = useState(ALL_MONTHS_VALUE)
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
