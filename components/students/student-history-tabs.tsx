"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnrollmentHistory } from "@/components/students/enrollment-history"
import type { EnrollmentEvent } from "@/lib/domain/disciplines/actions"
import {
  formatNumber,
  STUDENT_DETAIL_MESSAGES,
} from "@/lib/localization/es-ec"

export type StudentHistoryTab = "notes" | "payments"

const VISIBLE_EVENT_COUNT = 10

interface StudentHistoryTabsProps {
  /** Default active tab: "notes" for viewers who cannot manage, "payments" otherwise. */
  defaultTab: StudentHistoryTab
  noteCount: number
  paymentCount: number
  progressCount: number
  enrollmentEventCount: number
  /** Notes log slot (StudentNotesPanel + CreateNoteDialog when canManage). */
  notesSlot: ReactNode
  /** Payments slot (StudentPaymentHistory). */
  paymentsSlot: ReactNode
  /** Promotion timeline slot (StudentProgressPanel). */
  progressSlot: ReactNode
  /** Enrollment events, oldest first; bounded to the latest entries. */
  enrollmentEvents: EnrollmentEvent[]
}

function tabLabel(label: string, count: number) {
  return STUDENT_DETAIL_MESSAGES.TAB_WITH_COUNT(label, formatNumber(count))
}

/**
 * History section of the student detail page: Bitácora, Pagos, Progreso and
 * Inscripciones tabs. Tab contents are rendered on the server and passed as
 * slots; the enrollment events list is bounded here with a "Ver todo" toggle.
 */
export function StudentHistoryTabs({
  defaultTab,
  noteCount,
  paymentCount,
  progressCount,
  enrollmentEventCount,
  notesSlot,
  paymentsSlot,
  progressSlot,
  enrollmentEvents,
}: StudentHistoryTabsProps) {
  const [showAllEvents, setShowAllEvents] = useState(false)
  const isBounded =
    enrollmentEvents.length > VISIBLE_EVENT_COUNT && !showAllEvents
  const visibleEvents = isBounded
    ? enrollmentEvents.slice(-VISIBLE_EVENT_COUNT)
    : enrollmentEvents

  return (
    <Tabs defaultValue={defaultTab}>
      <div className="w-full overflow-x-auto">
        <TabsList className="max-w-full">
          <TabsTrigger value="notes">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_NOTES, noteCount)}</TabsTrigger>
          <TabsTrigger value="payments">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_PAYMENTS, paymentCount)}</TabsTrigger>
          <TabsTrigger value="progress">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_PROGRESS, progressCount)}</TabsTrigger>
          <TabsTrigger value="enrollments">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_ENROLLMENTS, enrollmentEventCount)}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="notes">{notesSlot}</TabsContent>
      <TabsContent value="payments">{paymentsSlot}</TabsContent>
      <TabsContent value="progress">{progressSlot}</TabsContent>
      <TabsContent value="enrollments">
        {enrollmentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {STUDENT_DETAIL_MESSAGES.ENROLLMENTS_EMPTY}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <EnrollmentHistory events={visibleEvents} />
            {enrollmentEvents.length > VISIBLE_EVENT_COUNT && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllEvents((current) => !current)}
                >
                  {showAllEvents
                    ? STUDENT_DETAIL_MESSAGES.VIEW_LESS_ACTION
                    : STUDENT_DETAIL_MESSAGES.VIEW_ALL_ACTION(
                        formatNumber(enrollmentEvents.length)
                      )}
                </Button>
              </div>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
