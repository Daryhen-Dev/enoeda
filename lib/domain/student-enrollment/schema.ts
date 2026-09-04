import { z } from "zod";

import { studentCreateSchema, studentIdSchema } from "@/lib/domain/students/schema";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

const studentInvitationEmailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: STUDENT_ENROLLMENT_MESSAGES.INVALID_EMAIL }))
  .transform((value) => value.toLowerCase());

const studentPhoneSchema = z
  .string()
  .trim()
  .max(30, { error: STUDENT_ENROLLMENT_MESSAGES.PHONE_MAX_LENGTH })
  .nullish()
  .transform((value) => (value === "" ? null : value));

export const createStudentInvitationSchema = z
  .object({
    branch_id: z.uuid({ error: STUDENT_ENROLLMENT_MESSAGES.INVALID_BRANCH_ID }),
    email: studentInvitationEmailSchema,
  })
  .strict();

export const studentInvitationIdSchema = z.object({
  id: studentIdSchema,
}).strict();

export const studentEnrollmentPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: STUDENT_ENROLLMENT_MESSAGES.PASSWORD_MIN_LENGTH }),
  })
  .strict();

export const completeStudentEnrollmentSchema = studentCreateSchema
  .pick({
    date_of_birth: true,
    first_name: true,
    national_id: true,
    phone: true,
    surname: true,
  })
  .strict();

export const updateOwnStudentPhoneSchema = z
  .object({
    phone: studentPhoneSchema,
  })
  .strict();

export type CreateStudentInvitationInput = z.input<
  typeof createStudentInvitationSchema
>;
export type CompleteStudentEnrollmentInput = z.input<
  typeof completeStudentEnrollmentSchema
>;
export type UpdateOwnStudentPhoneInput = z.input<
  typeof updateOwnStudentPhoneSchema
>;
