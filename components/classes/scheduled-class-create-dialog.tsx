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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createScheduledClass } from "@/lib/domain/classes/actions";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  WEEKDAY_LABELS,
} from "@/lib/localization/es-ec";

interface ScheduledClassCreateDialogProps {
  branchId: string;
  disciplines: Array<{ id: string; name: string }>;
}

const WEEKDAYS = WEEKDAY_LABELS.map((label, value) => ({ value, label }));

export function ScheduledClassCreateDialog({
  branchId,
  disciplines,
}: ScheduledClassCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disciplineId, setDisciplineId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setDisciplineId("");
    setDayOfWeek("0");
    setStartTime("09:00");
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createScheduledClass({
        branch_id: branchId,
        discipline_id: disciplineId,
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
      });
      if (result.success) {
        setOpen(false);
        resetForm();
        toast.success(CLASS_MESSAGES.CREATED);
        router.refresh();
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
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
              <FieldLabel htmlFor="class-day">{CLASS_MESSAGES.DAY_LABEL}</FieldLabel>
              <Select
                value={dayOfWeek}
                onValueChange={(value) => {
                  if (value) setDayOfWeek(value);
                }}
              >
                <SelectTrigger id="class-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || !disciplineId}
            className="self-start"
          >
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
