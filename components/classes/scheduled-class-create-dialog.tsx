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
import { createScheduledClass } from "@/lib/domain/classes/actions";
import {
  CLASS_MESSAGES,
  COMMON_MESSAGES,
} from "@/lib/localization/es-ec";

interface ScheduledClassCreateDialogProps {
  branchId: string;
  disciplines: Array<{ id: string; name: string }>;
}

const WEEKDAYS = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

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
            Agregue una clase recurrente al horario semanal.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="class-discipline">Disciplina</FieldLabel>
              <select
                id="class-discipline"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                required
              >
                <option value="">Seleccionar…</option>
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="class-day">Día</FieldLabel>
              <select
                id="class-day"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="class-time">Hora de inicio</FieldLabel>
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
