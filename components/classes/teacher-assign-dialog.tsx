"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
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
import { assignTeacher } from "@/lib/domain/classes/actions";
import {
  COMMON_MESSAGES,
  TEACHER_ASSIGN_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
} from "@/lib/localization/es-ec";

interface TeacherAssignDialogProps {
  scheduledClassId: string;
  sessionDate: string;
  branchId: string;
  teachers: Array<{ id: string; name: string }>;
  currentTeacherId: string | null;
  triggerClassName?: string;
  triggerText?: string;
}

/**
 * Assigns a teacher to a specific session date (session-level override,
 * not the recurring template). There are no schedule restrictions any
 * more: the assignment applies directly, with no conflict confirmation.
 */
export function TeacherAssignDialog({
  scheduledClassId,
  sessionDate,
  branchId,
  teachers,
  currentTeacherId,
  triggerClassName,
  triggerText,
}: TeacherAssignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(currentTeacherId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!teacherId) return;
    startTransition(async () => {
      const result = await assignTeacher({
        target_type: "session",
        scheduled_class_id: scheduledClassId,
        session_date: sessionDate,
        teacher_id: teacherId,
        branch_id: branchId,
      });

      if (result.success && result.data?.teacher_assigned) {
        setOpen(false);
        toast.success(TEACHER_ASSIGN_MESSAGES.ASSIGNED);
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
          setTeacherId(currentTeacherId ?? "");
          setError(null);
        }
      }}
    >
      <SheetTrigger className={triggerClassName}>
        <UserPlusIcon data-icon="inline-start" />
        {triggerText ?? TEACHER_CONFLICT_MESSAGES.ASSIGN_ACTION}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{TEACHER_ASSIGN_MESSAGES.ASSIGN_TITLE}</SheetTitle>
          <SheetDescription>
            {TEACHER_ASSIGN_MESSAGES.ASSIGN_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="session-teacher">
                {TEACHER_ASSIGN_MESSAGES.TEACHER_LABEL}
              </FieldLabel>
              <Select
                value={teacherId}
                onValueChange={(value) => {
                  if (value) setTeacherId(value);
                }}
                items={teachers.map((t) => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger id="session-teacher" className="w-full">
                  <SelectValue
                    placeholder={TEACHER_ASSIGN_MESSAGES.TEACHER_PLACEHOLDER}
                  />
                </SelectTrigger>
                <SelectContent>
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
            disabled={isPending || !teacherId}
            onClick={handleSubmit}
          >
            {isPending
              ? COMMON_MESSAGES.LOADING
              : TEACHER_ASSIGN_MESSAGES.CONFIRM}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
