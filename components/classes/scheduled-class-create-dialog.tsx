"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMonthlyClassGroup } from "@/lib/domain/classes/actions";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  WEEKDAY_LABELS,
} from "@/lib/localization/es-ec";

interface ScheduledClassCreateDialogProps {
  branchId: string;
  disciplines: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string }>;
}

const WEEKDAYS = WEEKDAY_LABELS.map((label, value) => ({ value, label }));

/** Sentinel value for the "no teacher yet" option — Select items cannot use an empty string value. */
const NO_TEACHER_VALUE = "__none__";

const SERIES_NAME_MAX_LENGTH = 80;

const GROUP_TIME_ZONE = "America/Guayaquil";

/** How many months ahead the selector offers (including the current one). */
const MONTH_OPTION_COUNT = 12;

interface MonthOption {
  /** "YYYY-MM" value sent to the server action. */
  value: string;
  /** es-EC display label, e.g. "Septiembre de 2026". */
  label: string;
}

/**
 * Month options starting at the CURRENT month in America/Guayaquil,
 * covering the next 12 months. Computed once per dialog mount.
 */
function buildMonthOptions(): MonthOption[] {
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: GROUP_TIME_ZONE,
  }).formatToParts(new Date());
  const year = Number(nowParts.find((p) => p.type === "year")?.value);
  const month = Number(nowParts.find((p) => p.type === "month")?.value);

  const options: MonthOption[] = [];
  for (let offset = 0; offset < MONTH_OPTION_COUNT; offset++) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const rawLabel = new Intl.DateTimeFormat("es-EC", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    options.push({ value, label });
  }
  return options;
}

function validateSeriesName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return CLASS_MESSAGES.SERIES_NAME_REQUIRED;
  if (trimmed.length > SERIES_NAME_MAX_LENGTH)
    return CLASS_MESSAGES.SERIES_NAME_MAX;
  return null;
}

export function ScheduledClassCreateDialog({
  branchId,
  disciplines,
  teachers,
}: ScheduledClassCreateDialogProps) {
  const router = useRouter();
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [open, setOpen] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [disciplineId, setDisciplineId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(monthOptions[0].value);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [teacherId, setTeacherId] = useState(NO_TEACHER_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setSeriesName("");
    setNameError(null);
    setDisciplineId("");
    setPeriodMonth(monthOptions[0].value);
    setDaysOfWeek([]);
    setStartTime("09:00");
    setTeacherId(NO_TEACHER_VALUE);
    setError(null);
  }

  function toggleDay(day: number, checked: boolean) {
    setDaysOfWeek((prev) =>
      checked ? [...prev, day].sort((a, b) => a - b) : prev.filter((d) => d !== day)
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (daysOfWeek.length === 0) return;

    const nameValidationError = validateSeriesName(seriesName);
    if (nameValidationError) {
      setNameError(nameValidationError);
      return;
    }
    setNameError(null);

    startTransition(async () => {
      const result = await createMonthlyClassGroup({
        branch_id: branchId,
        discipline_id: disciplineId,
        default_teacher_id:
          teacherId === NO_TEACHER_VALUE ? null : teacherId,
        series_name: seriesName,
        period_month: periodMonth,
        days_of_week: daysOfWeek,
        start_time: startTime,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
        return;
      }

      setOpen(false);
      resetForm();
      toast.success(CLASS_MESSAGES.MONTHLY_GROUP_CREATED);
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <SheetTrigger render={<Button variant="default" size="default" />}>
        <PlusIcon data-icon="inline-start" />
        {CLASS_MESSAGES.CREATE_TITLE}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{CLASS_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>
            {CLASS_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="class-series-name">
                {CLASS_MESSAGES.SERIES_NAME_LABEL}
              </FieldLabel>
              <Input
                id="class-series-name"
                type="text"
                value={seriesName}
                onChange={(e) => {
                  setSeriesName(e.target.value);
                  if (nameError) setNameError(validateSeriesName(e.target.value));
                }}
                maxLength={SERIES_NAME_MAX_LENGTH}
                placeholder={CLASS_MESSAGES.SERIES_NAME_PLACEHOLDER}
                aria-invalid={nameError ? true : undefined}
                disabled={isPending}
                required
              />
              {nameError && <FieldError>{nameError}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="class-discipline">
                {CLASS_MESSAGES.DISCIPLINE_LABEL}
              </FieldLabel>
              <Select
                value={disciplineId}
                onValueChange={(value) => {
                  if (value) setDisciplineId(value);
                }}
                items={disciplines.map((d) => ({ value: d.id, label: d.name }))}
              >
                <SelectTrigger id="class-discipline" className="w-full">
                  <SelectValue placeholder={CLASS_MESSAGES.DISCIPLINE_PLACEHOLDER} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="class-month">
                {CLASS_MESSAGES.MONTH_LABEL}
              </FieldLabel>
              <Select
                value={periodMonth}
                onValueChange={(value) => {
                  if (value) setPeriodMonth(value);
                }}
                items={monthOptions.map((m) => ({ value: m.value, label: m.label }))}
              >
                <SelectTrigger id="class-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{CLASS_MESSAGES.DAYS_LABEL}</FieldLabel>
              <div
                className="flex flex-col gap-2"
                role="group"
                aria-label={CLASS_MESSAGES.DAYS_LABEL}
              >
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={daysOfWeek.includes(d.value)}
                      onCheckedChange={(checked) => toggleDay(d.value, Boolean(checked))}
                      disabled={isPending}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="class-time">
                {CLASS_MESSAGES.START_TIME_LABEL}
              </FieldLabel>
              <Input
                id="class-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="class-teacher">
                {CLASS_MESSAGES.TEACHER_LABEL}
              </FieldLabel>
              <Select
                value={teacherId}
                onValueChange={(value) => {
                  if (value) setTeacherId(value);
                }}
                items={[
                  { value: NO_TEACHER_VALUE, label: CLASS_MESSAGES.NO_TEACHER_OPTION },
                  ...teachers.map((t) => ({ value: t.id, label: t.name })),
                ]}
              >
                <SelectTrigger id="class-teacher" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER_VALUE}>
                    {CLASS_MESSAGES.NO_TEACHER_OPTION}
                  </SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={
              isPending || !disciplineId || !seriesName.trim() || daysOfWeek.length === 0
            }
            className="self-start"
          >
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
