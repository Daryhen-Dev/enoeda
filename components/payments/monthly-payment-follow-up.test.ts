/**
 * Monthly payment follow-up — what the screen says and does once a payment is
 * saved: name the new due date, and for a suspended enrollment reactivate it in
 * the same step, reporting honestly when only the payment went through.
 */

import { describe, expect, it, vi } from "vitest";

import { PAYMENT_FOLLOW_UP_MESSAGES, formatDate } from "@/lib/localization/es-ec";
import { parseDateOnly } from "@/lib/date";

import { followUpMonthlyPayment } from "./monthly-payment-follow-up";

describe("followUpMonthlyPayment", () => {
  it("names the new due date after a payment", async () => {
    const outcome = await followUpMonthlyPayment({ nextDueDate: "2026-12-05" });

    expect(outcome.tone).toBe("success");
    expect(outcome.title).toBe(PAYMENT_FOLLOW_UP_MESSAGES.PAID);
    expect(outcome.description).toBe(
      PAYMENT_FOLLOW_UP_MESSAGES.NEXT_DUE(formatDate(parseDateOnly("2026-12-05")))
    );
  });

  it("does not try to reactivate an enrollment that was not suspended", async () => {
    const reactivate = vi.fn();

    await followUpMonthlyPayment({ nextDueDate: "2026-12-05" });

    expect(reactivate).not.toHaveBeenCalled();
  });

  it("reactivates a suspended enrollment once the payment is saved", async () => {
    const reactivate = vi.fn().mockResolvedValue({ success: true });

    const outcome = await followUpMonthlyPayment({
      nextDueDate: "2026-12-05",
      reactivate,
    });

    expect(reactivate).toHaveBeenCalledTimes(1);
    expect(outcome.tone).toBe("success");
    expect(outcome.title).toBe(PAYMENT_FOLLOW_UP_MESSAGES.PAID_AND_REACTIVATED);
    expect(outcome.description).toBe(
      PAYMENT_FOLLOW_UP_MESSAGES.NEXT_DUE(formatDate(parseDateOnly("2026-12-05")))
    );
  });

  it("says the payment was saved even when the reactivation is rejected", async () => {
    const reactivate = vi
      .fn()
      .mockResolvedValue({ success: false, error: "No autorizado" });

    const outcome = await followUpMonthlyPayment({
      nextDueDate: "2026-12-05",
      reactivate,
    });

    // The money is in: never report the whole operation as failed.
    expect(outcome.tone).toBe("warning");
    expect(outcome.title).toBe(PAYMENT_FOLLOW_UP_MESSAGES.PAID_NOT_REACTIVATED);
    expect(outcome.description).toBe("No autorizado");
  });

  it("falls back to its own copy when the reactivation throws", async () => {
    const reactivate = vi.fn().mockRejectedValue(new Error("network"));

    const outcome = await followUpMonthlyPayment({
      nextDueDate: "2026-12-05",
      reactivate,
    });

    expect(outcome.tone).toBe("warning");
    expect(outcome.title).toBe(PAYMENT_FOLLOW_UP_MESSAGES.PAID_NOT_REACTIVATED);
    expect(outcome.description).toBe(
      PAYMENT_FOLLOW_UP_MESSAGES.REACTIVATE_MANUALLY
    );
  });
});
