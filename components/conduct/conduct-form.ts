/**
 * Shared conduct record form pieces: the client-side zod schema (mirroring
 * lib/domain/conduct validators and messages) and the builder that maps form
 * values to the discriminated-union server input. Used by the student-detail
 * dialog and the quick-entry page so both validate identically.
 */

import { z } from "zod";

import {
  createConductRecord,
  CONDUCT_KINDS,
  MAX_FINE_AMOUNT,
  type CreateConductRecordInput,
} from "@/lib/domain/conduct";
import { CONDUCT_MESSAGES } from "@/lib/localization/es-ec";

export interface ConductFormValues {
  kind: string
  reason: string
  incident_date: string
  amount: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Mirrors the private validators in lib/domain/conduct/schema.ts. */
function isValidCalendarDate(dateStr: string): boolean {
  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (month < 1 || month > 12) return false
  if (day < 1) return false
  if (year < 1900 || year > 2100) return false
  const daysInMonth = new Date(year, month, 0).getDate()
  return day <= daysInMonth
}

function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100
  return Math.abs(scaled - Math.round(scaled)) < 1e-9
}

/**
 * Client-side form schema mirroring lib/domain/conduct (same messages).
 * `todayDateOnly` (branch timezone) bounds the incident date.
 */
export function buildConductFormSchema(todayDateOnly: string) {
  return z
    .object({
      kind: z.string(),
      reason: z.string(),
      incident_date: z.string(),
      amount: z.string(),
    })
    .superRefine((values, ctx) => {
      const reason = values.reason.trim()
      if (reason.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: CONDUCT_MESSAGES.REASON_REQUIRED,
        })
      } else if (reason.length > 2000) {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: CONDUCT_MESSAGES.REASON_MAX,
        })
      }

      if (
        values.kind !== CONDUCT_KINDS.FINE &&
        values.kind !== CONDUCT_KINDS.WARNING
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["kind"],
          message: CONDUCT_MESSAGES.KIND_INVALID,
        })
      }

      const incidentDate = values.incident_date.trim()
      if (incidentDate !== "") {
        if (!DATE_PATTERN.test(incidentDate)) {
          ctx.addIssue({
            code: "custom",
            path: ["incident_date"],
            message: CONDUCT_MESSAGES.INCIDENT_DATE_FORMAT,
          })
        } else if (!isValidCalendarDate(incidentDate)) {
          ctx.addIssue({
            code: "custom",
            path: ["incident_date"],
            message: CONDUCT_MESSAGES.INCIDENT_DATE_INVALID,
          })
        } else if (incidentDate > todayDateOnly) {
          ctx.addIssue({
            code: "custom",
            path: ["incident_date"],
            message: CONDUCT_MESSAGES.INCIDENT_DATE_NOT_FUTURE,
          })
        }
      }

      if (values.kind === CONDUCT_KINDS.FINE) {
        const amount = values.amount.trim()
        if (amount === "") {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: CONDUCT_MESSAGES.AMOUNT_POSITIVE,
          })
          return
        }
        const parsed = Number(amount)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: CONDUCT_MESSAGES.AMOUNT_POSITIVE,
          })
        } else if (parsed > MAX_FINE_AMOUNT) {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: CONDUCT_MESSAGES.AMOUNT_MAX,
          })
        } else if (!hasAtMostTwoDecimals(parsed)) {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: CONDUCT_MESSAGES.AMOUNT_DECIMALS,
          })
        }
      }
    })
}

/**
 * Maps validated form values to the domain's discriminated union so amount
 * is only present for fines and an empty incident date becomes undefined.
 */
export async function submitConductForm(
  values: ConductFormValues,
  studentId: string,
  branchId: string
) {
  const isFine = values.kind === CONDUCT_KINDS.FINE
  const incidentDate = values.incident_date.trim()
  const incidentDateInput = incidentDate === "" ? undefined : incidentDate

  // The domain input is a discriminated union: build each branch
  // separately so amount is only present for fines.
  const input: CreateConductRecordInput = isFine
    ? {
        student_id: studentId,
        branch_id: branchId,
        kind: CONDUCT_KINDS.FINE,
        reason: values.reason.trim(),
        incident_date: incidentDateInput,
        amount: Number(values.amount.trim()),
      }
    : {
        student_id: studentId,
        branch_id: branchId,
        kind: CONDUCT_KINDS.WARNING,
        reason: values.reason.trim(),
        incident_date: incidentDateInput,
      }

  return createConductRecord(input)
}
