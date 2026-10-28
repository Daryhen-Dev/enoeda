"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnrollmentHistory } from "@/components/students/enrollment-history"
import type { EnrollmentEvent } from "@/lib/domain/disciplines/actions"
import type { StudentHistoryTab } from "@/lib/domain/students/history-tabs"
import {
  CONDUCT_MESSAGES,
  formatNumber,
  STUDENT_DETAIL_MESSAGES,
} from "@/lib/localization/es-ec"

const VISIBLE_EVENT_COUNT = 10

interface StudentHistoryTabsProps {
  /** Default active tab: "notes" for viewers who cannot manage, "payments" otherwise. */
  defaultTab: StudentHistoryTab
  noteCount: number
  paymentCount: number
  progressCount: number
  enrollmentEventCount: number
  conductCount: number
  /** Notes log slot (StudentNotesPanel + CreateNoteDialog when canManage). */
  notesSlot: ReactNode
  /** Conduct records slot (StudentConductPanel + CreateConductRecordDialog when canManage). */
  conductSlot: ReactNode
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
  conductCount,
  notesSlot,
  conductSlot,
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
      {/* Five tabs with counters overflow a phone. The list takes its natural
          width from the left edge (w-max + justify-start) so the container can
          scroll the whole strip; a centred, capped list spilled off the left
          side where no scroll could reach the first tab. */}
      <div className="w-full overflow-x-auto pb-1">
        <TabsList className="w-max justify-start">
          <TabsTrigger value="notes">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_NOTES, noteCount)}</TabsTrigger>
          <TabsTrigger value="conduct">{tabLabel(CONDUCT_MESSAGES.TAB_CONDUCT, conductCount)}</TabsTrigger>
          <TabsTrigger value="payments">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_PAYMENTS, paymentCount)}</TabsTrigger>
          <TabsTrigger value="progress">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_PROGRESS, progressCount)}</TabsTrigger>
          <TabsTrigger value="enrollments">{tabLabel(STUDENT_DETAIL_MESSAGES.TAB_ENROLLMENTS, enrollmentEventCount)}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="notes">{notesSlot}</TabsContent>
      <TabsContent value="conduct">{conductSlot}</TabsContent>
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
