import { parseDateOnly } from "@/lib/date"
import { PAYMENT_FOLLOW_UP_MESSAGES, formatDate } from "@/lib/localization/es-ec"

export interface PaymentFollowUpOutcome {
  /** "warning" when the payment is saved but the enrollment stayed suspended. */
  tone: "success" | "warning"
  title: string
  description: string
}

interface FollowUpInput {
  /** Due date the database reconciled after the payment ("YYYY-MM-DD"). */
  nextDueDate: string
  /**
   * Present only when the enrollment was suspended: brings it back once the
   * payment is saved. The server re-asserts authorization.
   */
  reactivate?: () => Promise<{ success: boolean; error?: string }>
}

/**
 * Decides what the screen says after a monthly payment. The payment is already
 * committed when this runs, so a failed reactivation is reported as "paid, but
 * still suspended" — never as a failed payment, which would invite a second,
 * duplicate charge.
 */
export async function followUpMonthlyPayment({
  nextDueDate,
  reactivate,
}: FollowUpInput): Promise<PaymentFollowUpOutcome> {
  const nextDue = PAYMENT_FOLLOW_UP_MESSAGES.NEXT_DUE(
    formatDate(parseDateOnly(nextDueDate))
  )

  if (!reactivate) {
    return {
      tone: "success",
      title: PAYMENT_FOLLOW_UP_MESSAGES.PAID,
      description: nextDue,
    }
  }

  try {
    const result = await reactivate()
    if (result.success) {
      return {
        tone: "success",
        title: PAYMENT_FOLLOW_UP_MESSAGES.PAID_AND_REACTIVATED,
        description: nextDue,
      }
    }

    return {
      tone: "warning",
      title: PAYMENT_FOLLOW_UP_MESSAGES.PAID_NOT_REACTIVATED,
      description: result.error ?? PAYMENT_FOLLOW_UP_MESSAGES.REACTIVATE_MANUALLY,
    }
  } catch {
    return {
      tone: "warning",
      title: PAYMENT_FOLLOW_UP_MESSAGES.PAID_NOT_REACTIVATED,
      description: PAYMENT_FOLLOW_UP_MESSAGES.REACTIVATE_MANUALLY,
    }
  }
}
