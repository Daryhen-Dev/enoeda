"use client";

import { useState, useTransition } from "react";
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
import { createScheduledClassBatch } from "@/lib/domain/classes/actions";
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

export function ScheduledClassCreateDialog({
  branchId,
  disciplines,
  teachers,
}: ScheduledClassCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disciplineId, setDisciplineId] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [teacherId, setTeacherId] = useState(NO_TEACHER_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [partialFailures, setPartialFailures] = useState<
    Array<{ day_of_week: number; error: string }>
  >([]);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setDisciplineId("");
    setDaysOfWeek([]);
    setStartTime("09:00");
    setTeacherId(NO_TEACHER_VALUE);
    setError(null);
    setPartialFailures([]);
  }

  function toggleDay(day: number, checked: boolean) {
    setDaysOfWeek((prev) =>
      checked ? [...prev, day].sort((a, b) => a - b) : prev.filter((d) => d !== day)
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (daysOfWeek.length === 0) return;
    startTransition(async () => {
      const result = await createScheduledClassBatch({
        branch_id: branchId,
        discipline_id: disciplineId,
        default_teacher_id:
          teacherId === NO_TEACHER_VALUE ? null : teacherId,
        days_of_week: daysOfWeek,
        start_time: startTime,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
        return;
      }

      const { created, failed } = result.data;

      if (failed.length === 0) {
        setOpen(false);
        resetForm();
        toast.success(
          created.length > 1
            ? CLASS_MESSAGES.CREATED_BATCH(created.length)
            : CLASS_MESSAGES.CREATED
        );
        router.refresh();
        return;
      }

      // Partial success: some days created, some conflicted — keep the
      // dialog open and show exactly what happened per day so the admin
      // stays in control of the outcome.
      setPartialFailures(failed);
      setError(null);
      toast.success(CLASS_MESSAGES.CREATED_BATCH(created.length));
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

            {partialFailures.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <p className="font-medium">{CLASS_MESSAGES.PARTIAL_FAILURE_TITLE}</p>
                <ul className="mt-1 list-inside list-disc">
                  {partialFailures.map((f) => (
                    <li key={f.day_of_week}>
                      {WEEKDAY_LABELS[f.day_of_week]}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || !disciplineId || daysOfWeek.length === 0}
            className="self-start"
          >
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
