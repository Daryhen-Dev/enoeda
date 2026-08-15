"use client"

import Link from "next/link"
import type { OverdueStudentRow } from "@/lib/domain/payments/queries"
import { formatDate, OVERDUE_MESSAGES } from "@/lib/localization/es-ec"

interface OverdueStudentsListProps {
  students: OverdueStudentRow[]
}

export function OverdueStudentsList({ students }: OverdueStudentsListProps) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {OVERDUE_MESSAGES.EMPTY_STATE}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">
              {OVERDUE_MESSAGES.STUDENT_NAME}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {OVERDUE_MESSAGES.DISCIPLINE}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {OVERDUE_MESSAGES.DUE_DATE}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <tr key={`${student.student_id}-${idx}`} className="border-b last:border-b-0">
              <td className="px-4 py-2">
                <Link
                  href={`/dashboard/students/${student.student_id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {student.student_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {student.discipline_name}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {formatDate(new Date(student.next_due_date))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
