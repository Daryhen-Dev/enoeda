"use client"

import type { PaymentRecord, ClassPaymentRecord } from "@/lib/domain/payments/actions"
import { formatDate, PAYMENT_MESSAGES } from "@/lib/localization/es-ec"

interface StudentPaymentHistoryProps {
  monthly: PaymentRecord[]
  perClass: ClassPaymentRecord[]
}

interface CombinedPaymentEntry {
  id: string
  type: "monthly" | "class"
  discipline_name: string
  amount: number
  date: Date
  detail: string
}

export function StudentPaymentHistory({
  monthly,
  perClass,
}: StudentPaymentHistoryProps) {
  const entries: CombinedPaymentEntry[] = [
    ...monthly.map((p) => ({
      id: p.id,
      type: "monthly" as const,
      discipline_name: p.discipline_name,
      amount: p.amount,
      date: new Date(p.payment_date),
      detail: `${p.months_covered}m`,
    })),
    ...perClass.map((p) => ({
      id: p.id,
      type: "class" as const,
      discipline_name: p.discipline_name,
      amount: p.amount,
      date: new Date(p.class_date),
      detail: "",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {PAYMENT_MESSAGES.NO_PAYMENTS}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">
              {PAYMENT_MESSAGES.PAYMENT_DATE_LABEL}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {PAYMENT_MESSAGES.DISCIPLINE_LABEL}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {PAYMENT_MESSAGES.AMOUNT_LABEL}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {PAYMENT_MESSAGES.TYPE_MONTHLY}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-b-0">
              <td className="px-4 py-2">{formatDate(entry.date)}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {entry.discipline_name}
              </td>
              <td className="px-4 py-2 tabular-nums">
                ${entry.amount.toFixed(2)}
              </td>
              <td className="px-4 py-2">
                {entry.type === "monthly"
                  ? `${PAYMENT_MESSAGES.TYPE_MONTHLY} (${entry.detail})`
                  : PAYMENT_MESSAGES.TYPE_CLASS}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
