"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon } from "lucide-react";
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
import { createOneTimeClass } from "@/lib/domain/classes/actions";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
  ONE_TIME_CLASS_MESSAGES,
} from "@/lib/localization/es-ec";

interface OneTimeClassCreateDialogProps {
  branchId: string;
  disciplines: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string }>;
}

/** Sentinel value for the "no teacher yet" option — Select items cannot use an empty string value. */
const NO_TEACHER_VALUE = "__none__";

export function OneTimeClassCreateDialog({
  branchId,
  disciplines,
  teachers,
}: OneTimeClassCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disciplineId, setDisciplineId] = useState("");
  const [classDate, setClassDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [teacherId, setTeacherId] = useState(NO_TEACHER_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setDisciplineId("");
    setClassDate("");
    setStartTime("09:00");
    setTeacherId(NO_TEACHER_VALUE);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createOneTimeClass({
        branch_id: branchId,
        discipline_id: disciplineId,
        teacher_id: teacherId === NO_TEACHER_VALUE ? null : teacherId,
        class_date: classDate,
        start_time: startTime,
      });
      if (result.success) {
        setOpen(false);
        resetForm();
        toast.success(ONE_TIME_CLASS_MESSAGES.CREATED);
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
      <SheetTrigger render={<Button variant="outline" size="default" />}>
        <CalendarPlusIcon data-icon="inline-start" />
        {ONE_TIME_CLASS_MESSAGES.CREATE_TITLE}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{ONE_TIME_CLASS_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>
            {ONE_TIME_CLASS_MESSAGES.CREATE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="one-time-discipline">
                {CLASS_MESSAGES.DISCIPLINE_LABEL}
              </FieldLabel>
              <Select
                value={disciplineId}
                onValueChange={(value) => {
                  if (value) setDisciplineId(value);
                }}
                items={disciplines.map((d) => ({ value: d.id, label: d.name }))}
              >
                <SelectTrigger id="one-time-discipline" className="w-full">
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
              <FieldLabel htmlFor="one-time-date">
                {ONE_TIME_CLASS_MESSAGES.DATE_LABEL}
              </FieldLabel>
              <Input
                id="one-time-date"
                type="date"
                value={classDate}
                onChange={(e) => setClassDate(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="one-time-time">
                {CLASS_MESSAGES.START_TIME_LABEL}
              </FieldLabel>
              <Input
                id="one-time-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="one-time-teacher">
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
                <SelectTrigger id="one-time-teacher" className="w-full">
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
            disabled={isPending || !disciplineId || !classDate}
            className="self-start"
          >
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.CREATE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
