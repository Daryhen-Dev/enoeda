import { parseDateOnly } from "@/lib/date";
import { PAYMENT_MESSAGES } from "@/lib/localization/es-ec";
import { z } from "zod";

export const PAYMENT_BRANCH_MESSAGES = {
  INVALID_BRANCH_ID: "Identificador de sucursal inválido.",
} as const;

const dateOnlySchema = z.string().refine(
  (value) => {
    try {
      parseDateOnly(value);
      return true;
    } catch {
      return false;
    }
  },
  { error: PAYMENT_MESSAGES.INVALID_DATE }
);

export function deriveMonthsCovered(periodStart: string, periodEnd: string): number {
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

export const configureDisciplineClassPriceSchema = z.object({
  discipline_id: z.string().uuid(),
  class_price: z.number().min(0).nullable(),
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
});
export type ConfigureDisciplineClassPriceInput = z.infer<typeof configureDisciplineClassPriceSchema>;

function validateMonthlyPeriod(input: { period_start: string; period_end: string }, context: z.RefinementCtx) {
  let periodStart: Date;
  let periodEnd: Date;
  try {
    periodStart = parseDateOnly(input.period_start);
    periodEnd = parseDateOnly(input.period_end);
  } catch {
    return;
  }
  if (periodEnd <= periodStart) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["period_end"], message: PAYMENT_MESSAGES.PERIOD_END_AFTER_START });
  } else if (deriveMonthsCovered(input.period_start, input.period_end) > 24) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["period_end"], message: PAYMENT_MESSAGES.PERIOD_MAX_24_MONTHS });
  }
}

const monthlyPaymentFieldsSchema = z.object({
  amount: z.number().min(0),
  period_start: dateOnlySchema,
  period_end: dateOnlySchema,
  payment_date: dateOnlySchema.optional(),
  note: z.string().max(500).optional(),
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
});

export const registerMonthlyPaymentSchema = monthlyPaymentFieldsSchema.extend({ student_discipline_id: z.string().uuid() }).strict().superRefine(validateMonthlyPeriod);
export type RegisterMonthlyPaymentInput = z.infer<typeof registerMonthlyPaymentSchema>;

export const registerClassPaymentSchema = z.object({
  student_discipline_id: z.string().uuid(),
  class_date: z.string().date().optional(),
  scheduled_class_id: z.string().uuid().optional(),
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
});
export type RegisterClassPaymentInput = z.infer<typeof registerClassPaymentSchema>;

export const getStudentPaymentsSchema = z.object({
  student_id: z.string().uuid(),
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
});
export type GetStudentPaymentsInput = z.infer<typeof getStudentPaymentsSchema>;

export const paymentConsoleFilterSchema = z.object({
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
  discipline_id: z.string().uuid().optional(),
  allow_global_admin_read: z.boolean().optional(),
});
export type PaymentConsoleFilterInput = z.infer<typeof paymentConsoleFilterSchema>;

const paymentIdSchema = z.string().uuid();
export const correctMonthlyPaymentSchema = monthlyPaymentFieldsSchema.extend({ id: paymentIdSchema }).strict().superRefine(validateMonthlyPeriod);
export type CorrectMonthlyPaymentInput = z.infer<typeof correctMonthlyPaymentSchema>;

export const correctClassPaymentSchema = z.object({
  id: paymentIdSchema,
  amount: z.number().min(0),
  class_date: dateOnlySchema,
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
}).strict();
export type CorrectClassPaymentInput = z.infer<typeof correctClassPaymentSchema>;

export const deletePaymentSchema = z.object({
  id: paymentIdSchema,
  branch_id: z.string().uuid({ error: PAYMENT_BRANCH_MESSAGES.INVALID_BRANCH_ID }),
}).strict();
export type DeletePaymentInput = z.infer<typeof deletePaymentSchema>;
