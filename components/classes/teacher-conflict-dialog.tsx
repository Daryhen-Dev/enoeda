"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AssignTeacherResult, ConflictingAssignment } from "@/lib/domain/classes/actions";
import { assignTeacher } from "@/lib/domain/classes/actions";
import {
  COMMON_MESSAGES,
  TEACHER_CONFLICT_MESSAGES,
} from "@/lib/localization/es-ec";

interface TeacherConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictingAssignment[];
  targetType: "recurring" | "session";
  scheduledClassId: string;
  sessionDate?: string;
  teacherId: string;
}

export function TeacherConflictDialog({
  open,
  onOpenChange,
  conflicts,
  targetType,
  scheduledClassId,
  sessionDate,
  teacherId,
}: TeacherConflictDialogProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await assignTeacher({
        target_type: targetType,
        scheduled_class_id: scheduledClassId,
        session_date: sessionDate,
        teacher_id: teacherId,
        force: true,
      });

      if (result.success && result.data?.success) {
        onOpenChange(false);
        toast.success(TEACHER_CONFLICT_MESSAGES.ASSIGNED);
        router.refresh();
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            {TEACHER_CONFLICT_MESSAGES.AFFECTED_TITLE}
          </SheetTitle>
          <SheetDescription>
            {TEACHER_CONFLICT_MESSAGES.WARNING}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <ul className="space-y-2">
            {conflicts.map((conflict) => (
              <li
                key={`${conflict.class_id}-${conflict.session_date ?? ""}`}
                className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm dark:border-amber-800 dark:bg-amber-950"
              >
                <span className="font-medium">{conflict.class_name}</span>
                <span className="text-muted-foreground">
                  {" — "}
                  {conflict.branch_name}
                </span>
                <div className="text-xs text-muted-foreground">
                  Día {conflict.day_of_week}, {conflict.start_time}
                  {conflict.session_date && ` (${conflict.session_date})`}
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {COMMON_MESSAGES.CANCEL}
            </Button>
            <Button
              variant="default"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending
                ? COMMON_MESSAGES.LOADING
                : TEACHER_CONFLICT_MESSAGES.CONFIRM}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
