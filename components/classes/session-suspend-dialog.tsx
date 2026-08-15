"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suspendSession } from "@/lib/domain/classes/actions";
import {
  COMMON_MESSAGES,
  SUSPENSION_MESSAGES,
} from "@/lib/localization/es-ec";

interface SessionSuspendDialogProps {
  scheduledClassId: string;
  sessionDate: string;
  trigger: React.ReactNode;
}

const CATEGORIES = [
  { value: "feriado", label: SUSPENSION_MESSAGES.CATEGORY_FERIADO },
  { value: "evento", label: SUSPENSION_MESSAGES.CATEGORY_EVENTO },
  { value: "emergencia", label: SUSPENSION_MESSAGES.CATEGORY_EMERGENCIA },
  { value: "otro", label: SUSPENSION_MESSAGES.CATEGORY_OTRO },
] as const;

export function SessionSuspendDialog({
  scheduledClassId,
  sessionDate,
  trigger,
}: SessionSuspendDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("feriado");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setCategory("feriado");
    setReason("");
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await suspendSession({
        scheduled_class_id: scheduledClassId,
        session_date: sessionDate,
        suspension_category: category as "feriado" | "evento" | "emergencia" | "otro",
        suspension_reason: reason || undefined,
      });
      if (result.success) {
        setOpen(false);
        resetForm();
        toast.success(SUSPENSION_MESSAGES.SUSPENDED);
        router.refresh();
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    });
  }

  const isOtro = category === "otro";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        {trigger}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{SUSPENSION_MESSAGES.SUSPEND_TITLE}</SheetTitle>
          <SheetDescription>
            {sessionDate}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="suspend-category">
                {SUSPENSION_MESSAGES.CATEGORY_LABEL}
              </FieldLabel>
              <Select
                value={category}
                onValueChange={(value) => {
                  if (value) setCategory(value);
                }}
              >
                <SelectTrigger id="suspend-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={isOtro && !reason}>
              <FieldLabel htmlFor="suspend-reason">
                {SUSPENSION_MESSAGES.REASON_LABEL}
                {isOtro && " *"}
              </FieldLabel>
              <textarea
                id="suspend-reason"
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                required={isOtro}
                placeholder={
                  isOtro ? "Ingrese el motivo…" : "Opcional"
                }
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || (isOtro && !reason)}
            className="self-start"
          >
            {isPending ? COMMON_MESSAGES.LOADING : SUSPENSION_MESSAGES.SUSPEND_TITLE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
