import { BRANCH_MESSAGES } from "@/lib/localization/es-ec";
import { z } from "zod";

/**
 * Branch validation schemas (Zod 4).
 * Used by server actions for input validation.
 */

export const BRANCH_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type BranchStatus =
  (typeof BRANCH_STATUS)[keyof typeof BRANCH_STATUS];

const BRANCH_STATUS_VALUES = [
  BRANCH_STATUS.ACTIVE,
  BRANCH_STATUS.INACTIVE,
] as const;

/**
 * Allowed IANA time zones for Ecuador.
 * - America/Guayaquil: continental Ecuador (UTC-5)
 * - Pacific/Galapagos: Galápagos Islands (UTC-6)
 */
export const ECUADOR_TIME_ZONES = {
  CONTINENTAL: "America/Guayaquil",
  GALAPAGOS: "Pacific/Galapagos",
} as const;

export type EcuadorTimeZone =
  (typeof ECUADOR_TIME_ZONES)[keyof typeof ECUADOR_TIME_ZONES];

export const ECUADOR_TIME_ZONE_VALUES = [
  ECUADOR_TIME_ZONES.CONTINENTAL,
  ECUADOR_TIME_ZONES.GALAPAGOS,
] as const;

const timeZoneSchema = z.enum(ECUADOR_TIME_ZONE_VALUES, {
  error: `${BRANCH_MESSAGES.INVALID_TIME_ZONE} ${ECUADOR_TIME_ZONE_VALUES.join(", ")}`,
});

export const branchIdSchema = z.uuid({ error: BRANCH_MESSAGES.INVALID_ID });

export const branchListSchema = z
  .object({
    status: z.enum(BRANCH_STATUS_VALUES).default(BRANCH_STATUS.ACTIVE),
  })
  .strict();

export const branchRecordSchema = z.object({
  id: branchIdSchema,
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  time_zone: timeZoneSchema,
  is_active: z.boolean(),
});

export const branchCreateSchema = z.object({
  name: z
    .string()
    .min(1, { error: BRANCH_MESSAGES.NAME_REQUIRED })
    .max(100, { error: BRANCH_MESSAGES.NAME_MAX_LENGTH }),
  address: z
    .string()
    .max(255, { error: BRANCH_MESSAGES.ADDRESS_MAX_LENGTH })
    .optional(),
  phone: z
    .string()
    .max(30, { error: BRANCH_MESSAGES.PHONE_MAX_LENGTH })
    .optional(),
  time_zone: timeZoneSchema.default(ECUADOR_TIME_ZONES.CONTINENTAL),
  is_active: z.boolean().default(true),
});

export const branchUpdateSchema = z
  .object({
    id: branchIdSchema,
    name: z
      .string()
      .min(1, { error: BRANCH_MESSAGES.NAME_REQUIRED })
      .max(100, { error: BRANCH_MESSAGES.NAME_MAX_LENGTH })
      .optional(),
    address: z
      .string()
      .max(255, { error: BRANCH_MESSAGES.ADDRESS_MAX_LENGTH })
      .nullable()
      .optional(),
    phone: z
      .string()
      .max(30, { error: BRANCH_MESSAGES.PHONE_MAX_LENGTH })
      .nullable()
      .optional(),
    time_zone: timeZoneSchema.optional(),
  })
  .refine(
    ({ name, address, phone, time_zone }) =>
      name !== undefined ||
      address !== undefined ||
      phone !== undefined ||
      time_zone !== undefined,
    { error: BRANCH_MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED }
  );

export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchListInput = z.infer<typeof branchListSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
