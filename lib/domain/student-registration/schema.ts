import { z } from "zod";

import { STUDENT_MESSAGES } from "@/lib/localization/es-ec";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  const [yearString, monthString, dayString] = value.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  return day <= new Date(year, month, 0).getDate();
}

export const publicStudentRegistrationSchema = z
  .object({
    branch_id: z.uuid({ error: STUDENT_MESSAGES.INVALID_BRANCH_ID }),
    first_name: z
      .string()
      .trim()
      .min(1, { error: STUDENT_MESSAGES.FIRST_NAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.FIRST_NAME_MAX_LENGTH }),
    surname: z
      .string()
      .trim()
      .min(1, { error: STUDENT_MESSAGES.SURNAME_REQUIRED })
      .max(100, { error: STUDENT_MESSAGES.SURNAME_MAX_LENGTH }),
    national_id: z
      .string()
      .trim()
      .min(1, { error: STUDENT_MESSAGES.NATIONAL_ID_REQUIRED })
      .max(30, { error: STUDENT_MESSAGES.NATIONAL_ID_MAX_LENGTH }),
    date_of_birth: z
      .string()
      .regex(DATE_PATTERN, { error: STUDENT_MESSAGES.DATE_OF_BIRTH_FORMAT })
      .refine(isValidCalendarDate, {
        error: STUDENT_MESSAGES.INVALID_DATE_OF_BIRTH,
      }),
    email: z
      .string()
      .trim()
      .pipe(z.email({ error: STUDENT_MESSAGES.INVALID_EMAIL }))
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, { error: "La contraseña debe tener al menos 8 caracteres." }),
    phone: z
      .string()
      .trim()
      .min(1, { error: "El teléfono es obligatorio." })
      .max(30, { error: STUDENT_MESSAGES.PHONE_MAX_LENGTH }),
  })
  .strict();

export type PublicStudentRegistrationInput = z.output<
  typeof publicStudentRegistrationSchema
>;
