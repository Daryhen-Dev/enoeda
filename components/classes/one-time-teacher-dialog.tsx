"use client";

import { useState, useTransition } from "react";
import type { ReactElement, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UserPenIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { setOneTimeClassTeacher } from "@/lib/domain/classes/actions";
import {
  COMMON_MESSAGES,
  TEACHER_ASSIGN_MESSAGES,
} from "@/lib/localization/es-ec";

/** Select sentinel for the "Sin profesor" option (teacher_id = null). */
const NO_TEACHER_VALUE = "__none__";

interface OneTimeTeacherDialogProps {
  oneTimeClassId: string;
  branchId: string;
  teachers: Array<{ id: string; name: string }>;
  currentTeacherId: string | null;
  /** Trigger content (defaults to the standard icon + action label). */
  trigger?: ReactNode;
  /** Optional element the trigger renders as (e.g. a styled Button). */
  triggerRender?: ReactElement;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

/**
 * Reusable teacher change for ONE one-time class. Unlike the recurring
 * per-date substitution sheet, the change is a plain update of the
 * one_time_classes row (works for any date) and "Sin profesor" is
 * allowed. Used from the calendar session block and from the class
 * schedules one-time section. There are no schedule restrictions any
 * more: no conflict confirmation runs.
 */
export function OneTimeTeacherDialog({
  oneTimeClassId,
  branchId,
  teachers,
  currentTeacherId,
  trigger,
  triggerRender,
  triggerClassName,
  triggerAriaLabel,
}: OneTimeTeacherDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(
    currentTeacherId ?? NO_TEACHER_VALUE
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await setOneTimeClassTeacher({
        branch_id: branchId,
        one_time_class_id: oneTimeClassId,
        teacher_id: teacherId === NO_TEACHER_VALUE ? null : teacherId,
      });

      if (result.success) {
        setOpen(false);
        toast.success(TEACHER_ASSIGN_MESSAGES.ONE_TIME_UPDATED);
        router.refresh();
        return;
      }

      setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setTeacherId(currentTeacherId ?? NO_TEACHER_VALUE);
          setError(null);
        }
      }}
    >
      <SheetTrigger
        {...(triggerRender ? { render: triggerRender } : {})}
        className={triggerClassName}
        aria-label={triggerAriaLabel}
      >
        {trigger ?? (
          <>
            <UserPenIcon data-icon="inline-start" />
            {TEACHER_ASSIGN_MESSAGES.ONE_TIME_ACTION}
          </>
        )}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{TEACHER_ASSIGN_MESSAGES.ONE_TIME_TITLE}</SheetTitle>
          <SheetDescription>
            {TEACHER_ASSIGN_MESSAGES.ONE_TIME_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`one-time-teacher-${oneTimeClassId}`}>
                {TEACHER_ASSIGN_MESSAGES.TEACHER_LABEL}
              </FieldLabel>
              <Select
                value={teacherId}
                onValueChange={(value) => {
                  if (value) setTeacherId(value);
                }}
                items={[
                  {
                    value: NO_TEACHER_VALUE,
                    label: TEACHER_ASSIGN_MESSAGES.NO_TEACHER_OPTION,
                  },
                  ...teachers.map((t) => ({ value: t.id, label: t.name })),
                ]}
              >
                <SelectTrigger
                  id={`one-time-teacher-${oneTimeClassId}`}
                  className="w-full"
                >
                  <SelectValue
                    placeholder={TEACHER_ASSIGN_MESSAGES.TEACHER_PLACEHOLDER}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER_VALUE}>
                    {TEACHER_ASSIGN_MESSAGES.NO_TEACHER_OPTION}
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
        </div>

        <SheetFooter>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending
              ? COMMON_MESSAGES.LOADING
              : TEACHER_ASSIGN_MESSAGES.ONE_TIME_CONFIRM}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
