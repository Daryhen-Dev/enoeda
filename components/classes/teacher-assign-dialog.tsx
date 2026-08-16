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
import type { ConflictingAssignment } from "@/lib/domain/classes/actions";
import { assignTeacher } from "@/lib/domain/classes/actions";
import { TeacherConflictDialog } from "@/components/classes/teacher-conflict-dialog";
import {
  COMMON_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
} from "@/lib/localization/es-ec";

interface TeacherAssignDialogProps {
  scheduledClassId: string;
  sessionDate: string;
  teachers: Array<{ id: string; name: string }>;
  currentTeacherId: string | null;
}

/**
 * Assigns a teacher to a specific session date (session-level override,
 * not the recurring template). Conflict-aware: if the chosen teacher is
 * already assigned elsewhere at the same day/time, delegates to
 * `TeacherConflictDialog` for explicit confirmation before forcing the
 * reassignment.
 */
export function TeacherAssignDialog({
  scheduledClassId,
  sessionDate,
  teachers,
  currentTeacherId,
}: TeacherAssignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(currentTeacherId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [conflictState, setConflictState] = useState<{
    open: boolean;
    conflicts: ConflictingAssignment[];
  }>({ open: false, conflicts: [] });

  function handleSubmit() {
    if (!teacherId) return;
    startTransition(async () => {
      const result = await assignTeacher({
        target_type: "session",
        scheduled_class_id: scheduledClassId,
        session_date: sessionDate,
        teacher_id: teacherId,
        force: false,
      });

      if (result.success && result.data?.success) {
        setOpen(false);
        toast.success(TEACHER_CONFLICT_MESSAGES.ASSIGNED);
        router.refresh();
        return;
      }

      if (result.success && result.data?.conflict) {
        setConflictState({
          open: true,
          conflicts: result.data.conflicting_assignments ?? [],
        });
        return;
      }

      setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
    });
  }

  return (
    <>
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
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <UserPlusIcon data-icon="inline-start" />
          {TEACHER_CONFLICT_MESSAGES.ASSIGN_ACTION}
        </SheetTrigger>
        <SheetContent side="right" size="content">
          <SheetHeader>
            <SheetTitle>{TEACHER_CONFLICT_MESSAGES.ASSIGN_TITLE}</SheetTitle>
            <SheetDescription>
              {TEACHER_CONFLICT_MESSAGES.ASSIGN_DESCRIPTION}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="session-teacher">
                  {TEACHER_CONFLICT_MESSAGES.TEACHER_LABEL}
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
                      placeholder={TEACHER_CONFLICT_MESSAGES.TEACHER_PLACEHOLDER}
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
              {isPending ? COMMON_MESSAGES.LOADING : TEACHER_CONFLICT_MESSAGES.CONFIRM}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TeacherConflictDialog
        open={conflictState.open}
        onOpenChange={(nextOpen) =>
          setConflictState((prev) => ({ ...prev, open: nextOpen }))
        }
        conflicts={conflictState.conflicts}
        targetType="session"
        scheduledClassId={scheduledClassId}
        sessionDate={sessionDate}
        teacherId={teacherId}
        onAssigned={() => setOpen(false)}
      />
    </>
  );
}
