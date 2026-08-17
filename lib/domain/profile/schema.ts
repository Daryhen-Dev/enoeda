import { z } from "zod";

import { TEACHER_PROFILE_MESSAGES } from "@/lib/localization/es-ec";

const PROFILE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) {
    return false;
  }
  return day <= new Date(year, month, 0).getDate();
}

export const ownProfileSchema = z
  .object({
    first_name: z
      .string()
      .min(1, { error: TEACHER_PROFILE_MESSAGES.FIRST_NAME_REQUIRED })
      .max(100, { error: TEACHER_PROFILE_MESSAGES.FIRST_NAME_MAX_LENGTH }),
    surname: z
      .string()
      .min(1, { error: TEACHER_PROFILE_MESSAGES.SURNAME_REQUIRED })
      .max(100, { error: TEACHER_PROFILE_MESSAGES.SURNAME_MAX_LENGTH }),
    phone: z
      .string()
      .max(30, { error: TEACHER_PROFILE_MESSAGES.PHONE_MAX_LENGTH })
      .optional(),
    date_of_birth: z
      .string()
      .regex(PROFILE_DATE_PATTERN, {
        error: TEACHER_PROFILE_MESSAGES.DATE_OF_BIRTH_FORMAT,
      })
      .refine(isValidCalendarDate, {
        error: TEACHER_PROFILE_MESSAGES.INVALID_DATE_OF_BIRTH,
      }),
  })
  .strict();

export type OwnProfileInput = z.infer<typeof ownProfileSchema>;
