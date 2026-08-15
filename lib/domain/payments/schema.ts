import { z } from "zod";

export const configureDisciplineClassPriceSchema = z.object({
  discipline_id: z.string().uuid(),
  class_price: z.number().min(0).nullable(),
});

export type ConfigureDisciplineClassPriceInput = z.infer<
  typeof configureDisciplineClassPriceSchema
>;

export const registerMonthlyPaymentSchema = z.object({
  student_discipline_id: z.string().uuid(),
  amount: z.number().min(0),
  months_covered: z.number().int().min(1).max(12),
  payment_date: z.string().date().optional(),
  note: z.string().max(500).optional(),
});

export type RegisterMonthlyPaymentInput = z.infer<
  typeof registerMonthlyPaymentSchema
>;

export const registerClassPaymentSchema = z.object({
  student_discipline_id: z.string().uuid(),
  class_date: z.string().date().optional(),
  scheduled_class_id: z.string().uuid().optional(),
});

export type RegisterClassPaymentInput = z.infer<
  typeof registerClassPaymentSchema
>;

export const getStudentPaymentsSchema = z.object({
  student_id: z.string().uuid(),
});

export type GetStudentPaymentsInput = z.infer<typeof getStudentPaymentsSchema>;
