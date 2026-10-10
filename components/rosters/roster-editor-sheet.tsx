"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addStudentsToRoster,
  listClassRoster,
  listRosterCandidates,
  removeStudentFromRoster,
  type AddStudentsToRosterResult,
  type RosterCandidateRow,
  type RosterSkipReason,
  type RosterStudentRow,
} from "@/lib/domain/rosters/actions";
import {
  COMMON_MESSAGES,
  ROSTER_EDITOR_MESSAGES,
  ROSTER_MESSAGES,
} from "@/lib/localization/es-ec";

/** Roster target without branch_id (the sheet always sends the caller's branch). */
export type RosterEditorTarget =
  | { kind: "series"; series_id: string }
  | { kind: "one_time"; one_time_class_id: string };

/** Localized reason copy for every roster skip reason (add + clone flows). */
export const ROSTER_SKIP_REASON_LABELS: Record<RosterSkipReason, string> = {
  already_assigned: ROSTER_MESSAGES.SKIPPED_ALREADY_ASSIGNED,
  not_eligible: ROSTER_MESSAGES.SKIPPED_NOT_ELIGIBLE,
  inactive: ROSTER_MESSAGES.SKIPPED_INACTIVE,
  branch_mismatch: ROSTER_MESSAGES.SKIPPED_BRANCH_MISMATCH,
};

const SEARCH_DEBOUNCE_MS = 300;

interface RosterEditorSheetProps {
  branchId: string;
  target: RosterEditorTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SkippedSummaryRow {
  student_id: string;
  name: string;
  reason: RosterSkipReason;
}

/**
 * Roster editor sheet — admin view to manage the assigned students of a
 * monthly class group (series) or a one-time class. Controlled component:
 * the parent owns the open state so it can open the editor programmatically
 * (clone follow-up, create follow-up). Data loads when the sheet opens;
 * the candidate search is debounced. Render only for admins (canManage) —
 * every action re-asserts authorization server-side.
 */
export function RosterEditorSheet({
  branchId,
  target,
  open,
  onOpenChange,
}: RosterEditorSheetProps) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterStudentRow[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<RosterCandidateRow[] | null>(
    null
  );
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addSummary, setAddSummary] = useState<{
    addedCount: number;
    skipped: SkippedSummaryRow[];
  } | null>(null);
  const [removingStudent, setRemovingStudent] =
    useState<RosterStudentRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isWritePending, startWriteTransition] = useTransition();
  // Sequence guards: only the latest roster/candidate load may update state.
  const rosterSeqRef = useRef(0);
  const searchSeqRef = useRef(0);

  const title =
    target.kind === "series"
      ? ROSTER_EDITOR_MESSAGES.SERIES_TITLE
      : ROSTER_EDITOR_MESSAGES.ONE_TIME_TITLE;

  const loadRoster = useCallback(async () => {
    const seq = ++rosterSeqRef.current;
    try {
      const result = await listClassRoster({ branch_id: branchId, ...target });
      if (seq !== rosterSeqRef.current) return;
      if (result.success && result.data) {
        setRoster(result.data.students);
        setRosterError(null);
      } else {
        setRosterError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    } catch {
      if (seq === rosterSeqRef.current) {
        setRosterError(COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    }
  }, [branchId, target]);

  const loadCandidates = useCallback(async (search: string) => {
    const seq = ++searchSeqRef.current;
    try {
      const result = await listRosterCandidates({
        branch_id: branchId,
        ...target,
        ...(search ? { search } : {}),
      });
      if (seq !== searchSeqRef.current) return;
      if (result.success && result.data) {
        setCandidates(result.data.students);
        setCandidatesError(null);
      } else {
        setCandidatesError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    } catch {
      if (seq === searchSeqRef.current) {
        setCandidatesError(COMMON_MESSAGES.UNEXPECTED_ERROR);
      }
    }
  }, [branchId, target]);

  // Load the roster when the sheet opens; the candidate search input is
  // debounced (SEARCH_DEBOUNCE_MS). setState calls only ever run inside
  // timer/async callbacks, never synchronously in the effect body.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void loadRoster();
    }, 0);
    return () => clearTimeout(timer);
  }, [open, loadRoster]);

  useEffect(() => {
    if (!open) return;
    const trimmed = searchInput.trim();
    // Debounce only real queries; the initial (empty) load is immediate.
    const delay = trimmed ? SEARCH_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      void loadCandidates(trimmed);
    }, delay);
    return () => clearTimeout(timer);
  }, [open, searchInput, loadCandidates]);

  function toggleSelected(studentId: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked
        ? [...prev, studentId]
        : prev.filter((id) => id !== studentId)
    );
  }

  function handleAddSelected() {
    if (selectedIds.length === 0) return;
    const candidateById = new Map(
      (candidates ?? []).map((candidate) => [candidate.student_id, candidate])
    );

    startWriteTransition(async () => {
      const result = await addStudentsToRoster({
        branch_id: branchId,
        ...target,
        student_ids: selectedIds,
      });
      if (!result.success || !result.data) {
        setAddSummary(null);
        toast.error(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
        return;
      }

      const skipped: SkippedSummaryRow[] = result.data.skipped.map(
        (row: AddStudentsToRosterResult["skipped"][number]) => {
          const candidate = candidateById.get(row.student_id);
          const name = candidate
            ? `${candidate.first_name} ${candidate.surname}`.trim()
            : row.student_id;
          return { student_id: row.student_id, name, reason: row.reason };
        }
      );
      setAddSummary({ addedCount: result.data.added.length, skipped });
      setSelectedIds([]);
      await Promise.all([loadRoster(), loadCandidates(searchInput.trim())]);
      router.refresh();
    });
  }

  function handleRemoveConfirm() {
    if (!removingStudent) return;
    const student = removingStudent;

    startWriteTransition(async () => {
      const result = await removeStudentFromRoster({
        branch_id: branchId,
        ...target,
        student_id: student.student_id,
      });
      setRemovingStudent(null);
      if (!result.success || !result.data?.removed) {
        setRemoveError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR);
        return;
      }
      setRemoveError(null);
      toast.success(ROSTER_EDITOR_MESSAGES.REMOVE_SUCCESS);
      await Promise.all([loadRoster(), loadCandidates(searchInput.trim())]);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {ROSTER_EDITOR_MESSAGES.DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          <section
            aria-label={ROSTER_EDITOR_MESSAGES.ROSTER_HEADING}
            className="flex flex-col gap-2"
          >
            <h3 className="text-sm font-medium">
              {ROSTER_EDITOR_MESSAGES.ROSTER_HEADING}
            </h3>
            {rosterError ? (
              <p role="alert" className="text-sm text-destructive">
                {rosterError}
              </p>
            ) : roster === null ? (
              <p className="text-sm text-muted-foreground">
                {COMMON_MESSAGES.LOADING}
              </p>
            ) : roster.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>
                    {ROSTER_EDITOR_MESSAGES.ROSTER_EMPTY_TITLE}
                  </EmptyTitle>
                  <EmptyDescription>
                    {ROSTER_EDITOR_MESSAGES.ROSTER_EMPTY_DESCRIPTION}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul
                aria-label={ROSTER_EDITOR_MESSAGES.ROSTER_LIST_ARIA_LABEL}
                className="flex flex-col"
              >
                {roster.map((student) => (
                  <li
                    key={student.student_id}
                    className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {student.surname} {student.first_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {student.national_id}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={isWritePending}
                      aria-label={ROSTER_EDITOR_MESSAGES.REMOVE_ARIA_LABEL(
                        `${student.first_name} ${student.surname}`.trim()
                      )}
                      onClick={() => setRemovingStudent(student)}
                    >
                      {ROSTER_EDITOR_MESSAGES.REMOVE_ACTION}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label={ROSTER_EDITOR_MESSAGES.CANDIDATES_HEADING}
            className="flex flex-col gap-2"
          >
            <h3 className="text-sm font-medium">
              {ROSTER_EDITOR_MESSAGES.CANDIDATES_HEADING}
            </h3>
            <Field>
              <FieldLabel htmlFor="roster-candidate-search">
                {ROSTER_EDITOR_MESSAGES.CANDIDATES_SEARCH_LABEL}
              </FieldLabel>
              <Input
                id="roster-candidate-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={ROSTER_EDITOR_MESSAGES.CANDIDATES_SEARCH_PLACEHOLDER}
                maxLength={100}
              />
            </Field>
            {candidatesError ? (
              <p role="alert" className="text-sm text-destructive">
                {candidatesError}
              </p>
            ) : candidates === null ? (
              <p className="text-sm text-muted-foreground">
                {COMMON_MESSAGES.LOADING}
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {ROSTER_EDITOR_MESSAGES.CANDIDATES_EMPTY}
              </p>
            ) : (
              <ul
                aria-label={ROSTER_EDITOR_MESSAGES.CANDIDATES_HEADING_ARIA}
                className="flex flex-col"
              >
                {candidates.map((candidate) => (
                  <li key={candidate.student_id}>
                    <label className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0">
                      <Checkbox
                        checked={selectedIds.includes(candidate.student_id)}
                        onCheckedChange={(checked) =>
                          toggleSelected(
                            candidate.student_id,
                            Boolean(checked)
                          )
                        }
                        disabled={isWritePending}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {candidate.surname} {candidate.first_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {candidate.national_id}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Button
              disabled={
                isWritePending ||
                selectedIds.length === 0 ||
                candidates === null ||
                candidates.length === 0
              }
              className="self-start"
              onClick={handleAddSelected}
            >
              {isWritePending
                ? COMMON_MESSAGES.LOADING
                : ROSTER_EDITOR_MESSAGES.ADD_SELECTED_ACTION}
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
          </section>

          <div role="status" aria-live="polite">
            {addSummary && (
              <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
                <p>{ROSTER_EDITOR_MESSAGES.ADD_SUCCESS(addSummary.addedCount)}</p>
                {addSummary.skipped.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">
                      {ROSTER_EDITOR_MESSAGES.SKIPPED_SUMMARY_TITLE}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {addSummary.skipped.map((row) => (
                        <li key={row.student_id} className="text-muted-foreground">
                          {row.name}: {ROSTER_SKIP_REASON_LABELS[row.reason]}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AlertDialog
          open={removingStudent !== null}
          onOpenChange={(nextOpen) => {
            if (isWritePending) return;
            if (!nextOpen) setRemovingStudent(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ROSTER_EDITOR_MESSAGES.REMOVE_CONFIRM_TITLE}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {removingStudent
                  ? ROSTER_EDITOR_MESSAGES.REMOVE_CONFIRM_DESCRIPTION(
                      `${removingStudent.first_name} ${removingStudent.surname}`.trim()
                    )
                  : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {removeError && (
              <p role="alert" className="text-sm text-destructive">
                {removeError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isWritePending}>
                {COMMON_MESSAGES.CANCEL}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isWritePending}
                onClick={handleRemoveConfirm}
              >
                {isWritePending
                  ? COMMON_MESSAGES.LOADING
                  : ROSTER_EDITOR_MESSAGES.REMOVE_CONFIRM_ACTION}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
