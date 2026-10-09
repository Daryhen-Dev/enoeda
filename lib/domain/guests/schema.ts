import { z } from "zod";
import { GUEST_MESSAGES } from "@/lib/localization/es-ec";

/**
 * Guest validation schemas (Zod 4).
 * Guests are trial-class attendees: no national id, email or birth date.
 * The session target shape mirrors the attendance entry points (either a
 * recurring scheduled_class_id with its session_date, or a one_time_class_id
 * whose date is fixed at creation).
 */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a YYYY-MM-DD string represents a real calendar date.
 * Rejects Feb 30, Apr 31, etc.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  if (year < 1900 || year > 2100) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/** Plain occurrence fields; each action applies its own refinements. */
const sessionOccurrenceObject = z.object({
  branch_id: z.uuid({ error: GUEST_MESSAGES.INVALID_BRANCH_ID }),
  scheduled_class_id: z
    .uuid({ error: GUEST_MESSAGES.INVALID_CLASS_ID })
    .optional(),
  one_time_class_id: z
    .uuid({ error: GUEST_MESSAGES.INVALID_CLASS_ID })
    .optional(),
  session_date: z
    .string()
    .regex(DATE_PATTERN, { error: GUEST_MESSAGES.INVALID_DATE })
    .refine(isValidCalendarDate, { error: GUEST_MESSAGES.INVALID_DATE })
    .optional(),
});

/** Exactly one class kind; recurring sessions require a session_date. */
function refineSingleOccurrence<
  T extends {
    scheduled_class_id?: string;
    one_time_class_id?: string;
    session_date?: string;
  }
>(schema: z.ZodType<T>) {
  return schema
    .refine(
      (d) => Boolean(d.scheduled_class_id) !== Boolean(d.one_time_class_id),
      { error: GUEST_MESSAGES.INVALID_CLASS_ID, path: ["scheduled_class_id"] }
    )
    .refine(
      (d) => !d.scheduled_class_id || Boolean(d.session_date),
      { error: GUEST_MESSAGES.INVALID_DATE, path: ["session_date"] }
    );
}

const guestNameSchema = z
  .string()
  .trim()
  .min(1, { error: GUEST_MESSAGES.FIRST_NAME_REQUIRED })
  .max(100, { error: GUEST_MESSAGES.FIRST_NAME_MAX });

const guestSurnameSchema = z
  .string()
  .trim()
  .min(1, { error: GUEST_MESSAGES.SURNAME_REQUIRED })
  .max(100, { error: GUEST_MESSAGES.SURNAME_MAX });

export const addGuestToSessionSchema = refineSingleOccurrence(
  sessionOccurrenceObject.extend({
    first_name: guestNameSchema,
    surname: guestSurnameSchema,
    phone: z
      .string()
      .trim()
      .max(30, { error: GUEST_MESSAGES.PHONE_MAX })
      .optional(),
    observation: z
      .string()
      .trim()
      .max(500, { error: GUEST_MESSAGES.OBSERVATION_MAX })
      .optional(),
  })
);

export type AddGuestToSessionInput = z.infer<typeof addGuestToSessionSchema>;

export const listSessionGuestsSchema = refineSingleOccurrence(
  sessionOccurrenceObject
);

export type ListSessionGuestsInput = z.infer<typeof listSessionGuestsSchema>;

export const removeGuestFromSessionSchema = z.object({
  branch_id: z.uuid({ error: GUEST_MESSAGES.INVALID_BRANCH_ID }),
  guest_id: z.uuid({ error: GUEST_MESSAGES.INVALID_GUEST_ID }),
});

export type RemoveGuestFromSessionInput = z.infer<
  typeof removeGuestFromSessionSchema
>;

export const getGuestForConversionSchema = z.object({
  branch_id: z.uuid({ error: GUEST_MESSAGES.INVALID_BRANCH_ID }),
  guest_id: z.uuid({ error: GUEST_MESSAGES.INVALID_GUEST_ID }),
});

export type GetGuestForConversionInput = z.infer<
  typeof getGuestForConversionSchema
>;

export const linkGuestToStudentSchema = z.object({
  branch_id: z.uuid({ error: GUEST_MESSAGES.INVALID_BRANCH_ID }),
  guest_id: z.uuid({ error: GUEST_MESSAGES.INVALID_GUEST_ID }),
  student_id: z.uuid({ error: GUEST_MESSAGES.INVALID_STUDENT_ID }),
});

export type LinkGuestToStudentInput = z.infer<typeof linkGuestToStudentSchema>;
