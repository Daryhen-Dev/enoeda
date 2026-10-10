import { ROSTER_MESSAGES } from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Roster target: a monthly class group (class_series) OR a one-time class.
 * The caller always passes branch_id alongside the target id so the action
 * can enforce branch context before any lookup (fail-closed).
 */
function rosterTargetUnion<T extends z.ZodRawShape>(extraFields: T) {
  return z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("series"),
      series_id: z.uuid(),
      ...extraFields,
    }),
    z.object({
      kind: z.literal("one_time"),
      one_time_class_id: z.uuid(),
      ...extraFields,
    }),
  ]);
}

export const listClassRosterSchema = rosterTargetUnion({
  branch_id: z.uuid(),
});

const rosterSearchSchema = z
  .string()
  .trim()
  .max(100, ROSTER_MESSAGES.SEARCH_MAX_LENGTH)
  .optional();

export const listRosterCandidatesSchema = rosterTargetUnion({
  branch_id: z.uuid(),
  search: rosterSearchSchema,
});

const studentIdsSchema = z
  .array(z.uuid())
  .min(1, ROSTER_MESSAGES.STUDENT_IDS_REQUIRED)
  .max(100, ROSTER_MESSAGES.STUDENT_IDS_TOO_LONG)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: ROSTER_MESSAGES.STUDENT_IDS_UNIQUE,
  });

export const addStudentsToRosterSchema = rosterTargetUnion({
  branch_id: z.uuid(),
  student_ids: studentIdsSchema,
});

export const removeStudentFromRosterSchema = rosterTargetUnion({
  branch_id: z.uuid(),
  student_id: z.uuid(),
});

export type ListClassRosterInput = z.infer<typeof listClassRosterSchema>;
export type ListRosterCandidatesInput = z.infer<
  typeof listRosterCandidatesSchema
>;
export type AddStudentsToRosterInput = z.infer<
  typeof addStudentsToRosterSchema
>;
export type RemoveStudentFromRosterInput = z.infer<
  typeof removeStudentFromRosterSchema
>;
