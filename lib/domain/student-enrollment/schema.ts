import { z } from "zod";

import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

const studentPhoneSchema = z
  .string()
  .trim()
  .max(30, { error: STUDENT_ENROLLMENT_MESSAGES.PHONE_MAX_LENGTH })
  .nullish()
  .transform((value) => (value === "" ? null : value));

export const updateOwnStudentPhoneSchema = z
  .object({
    phone: studentPhoneSchema,
  })
  .strict();

export type UpdateOwnStudentPhoneInput = z.input<
  typeof updateOwnStudentPhoneSchema
>;
