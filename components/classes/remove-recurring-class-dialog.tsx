"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  deactivateAllFutureClasses,
  deactivateScheduledClass,
  deactivateScheduledClassSeries,
} from "@/lib/domain/classes/actions";
import {
  COMMON_MESSAGES,
  REMOVE_RECURRING_CLASS_MESSAGES,
} from "@/lib/localization/es-ec";

const DEFAULT_TRIGGER_CLASSES =
  "text-destructive border-destructive hover:bg-destructive hover:text-white";

type RemoveScope = "series" | "single" | "all";

interface RemoveRecurringClassDialogProps {
  scheduledClassId: string;
  branchId: string;
  disciplineName: string;
  startTime: string;
  trigger?: React.ReactNode;
  triggerClassName?: string;
  disabled?: boolean;
}

export function RemoveRecurringClassDialog({
  scheduledClassId,
  branchId,
  disciplineName,
  startTime,
  trigger,
  triggerClassName,
  disabled = false,
}: RemoveRecurringClassDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<RemoveScope>("series");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextIsOpen: boolean) {
    if (isPending) return;

    setIsOpen(nextIsOpen);
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result =
        scope === "series"
          ? await deactivateScheduledClassSeries({
              branch_id: branchId,
              scheduled_class_id: scheduledClassId,
            })
          : scope === "all"
            ? await deactivateAllFutureClasses({
                branch_id: branchId,
              })
            : await deactivateScheduledClass({
                id: scheduledClassId,
                branch_id: branchId,
              });

      if (result.success) {
        setIsOpen(false);
        toast.success(
          scope === "series"
            ? REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS_SERIES
            : scope === "all"
              ? REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS_ALL
              : REMOVE_RECURRING_CLASS_MESSAGES.SUCCESS
        );
        router.refresh();
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    });
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={disabled}
        render={
          <Button
            variant="outline"
            aria-label={REMOVE_RECURRING_CLASS_MESSAGES.ARIA_LABEL(
              disciplineName,
              startTime
            )}
            className={triggerClassName ?? DEFAULT_TRIGGER_CLASSES}
          />
        }
      >
        {trigger ?? (
          <>
            <Trash2Icon aria-hidden="true" data-icon="inline-start" />
            {REMOVE_RECURRING_CLASS_MESSAGES.ACTION}
          </>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {REMOVE_RECURRING_CLASS_MESSAGES.DIALOG_DESCRIPTION}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div
          role="radiogroup"
          aria-label={REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_GROUP_LABEL}
          className="flex flex-col gap-2"
        >
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="remove-recurring-class-scope"
              value="series"
              checked={scope === "series"}
              onChange={() => setScope("series")}
              disabled={isPending}
              className="mt-1 accent-destructive"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_SERIES_LABEL}
              </span>
              <span className="text-sm text-muted-foreground">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_SERIES_HINT(
                  disciplineName,
                  startTime
                )}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="remove-recurring-class-scope"
              value="single"
              checked={scope === "single"}
              onChange={() => setScope("single")}
              disabled={isPending}
              className="mt-1 accent-destructive"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_SINGLE_LABEL}
              </span>
              <span className="text-sm text-muted-foreground">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_SINGLE_HINT}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="remove-recurring-class-scope"
              value="all"
              checked={scope === "all"}
              onChange={() => setScope("all")}
              disabled={isPending}
              className="mt-1 accent-destructive"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_ALL_LABEL}
              </span>
              <span className="text-sm text-muted-foreground">
                {REMOVE_RECURRING_CLASS_MESSAGES.SCOPE_ALL_HINT}
              </span>
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {COMMON_MESSAGES.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? COMMON_MESSAGES.LOADING
              : REMOVE_RECURRING_CLASS_MESSAGES.CONFIRM_ACTION}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
