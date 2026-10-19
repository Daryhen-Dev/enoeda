// @vitest-environment jsdom

import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { SessionView } from "@/lib/domain/classes/actions"
import {
  ATTENDANCE_FORM_MESSAGES,
  CALENDAR_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
} from "@/lib/localization/es-ec"

const { dialogSpy } = vi.hoisted(() => ({ dialogSpy: vi.fn() }))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/attendance/attendance-sheet-dialog", () => ({
  AttendanceSheetDialog: (props: Record<string, unknown>) => {
    dialogSpy(props)
    return (
      <button data-testid="attendance-trigger" disabled={Boolean(props.disabled)}>
        {(props.triggerLabel as string | undefined) ?? ATTENDANCE_FORM_MESSAGES.TAKE_ATTENDANCE}
      </button>
    )
  },
}))

import { TodayAgendaPanel } from "./today-agenda-panel"

const BRANCH_ID = "bbbbbbbb-1111-2222-3333-444444444444"

function buildSession(
  overrides: Partial<SessionView> & { start_time: string; scheduled_class_id: string }
): SessionView {
  return {
    session_date: "2026-10-20",
    discipline_id: "discipline-1",
    discipline_name: "Karate",
    discipline_code: "karate",
    end_time: "19:00",
    teacher_id: "teacher-1",
    effective_teacher_name: "Profesor López",
    status: "scheduled",
    suspension_category: null,
    suspension_reason: null,
    is_substitute: false,
    is_one_time: false,
    ...overrides,
  }
}

interface RenderedPanel {
  container: HTMLElement
  unmount(): void
}

function renderPanel(
  props: Partial<Parameters<typeof TodayAgendaPanel>[0]> & {
    sessions: Parameters<typeof TodayAgendaPanel>[0]["sessions"]
  }
): RenderedPanel {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(<TodayAgendaPanel {...props} branchId={props.branchId ?? BRANCH_ID} />)
  })

  return {
    container,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe("TodayAgendaPanel", () => {
  let rendered: RenderedPanel | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    dialogSpy.mockClear()
  })

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
  })

  it("renders one row per session sorted by start_time with the right state text", () => {
    rendered = renderPanel({
      sessions: [
        buildSession({
          start_time: "18:00",
          scheduled_class_id: "class-evening",
          status: "suspended",
          suspension_reason: "Feriado",
        }),
        buildSession({
          start_time: "07:00",
          scheduled_class_id: "class-morning",
          attendance: { record_count: 12, present_count: 10 },
          can_view_attendance: true,
          can_take_attendance: true,
        }),
        buildSession({
          start_time: "10:30",
          scheduled_class_id: "class-midday",
          can_view_attendance: true,
          can_take_attendance: true,
        }),
      ],
    })

    const rows = rendered.container.querySelectorAll("ul > li")
    expect(rows).toHaveLength(3)
    expect(rows[0]?.textContent).toContain("07:00–19:00")
    expect(rows[0]?.textContent).toContain(
      CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(10)
    )
    expect(rows[1]?.textContent).toContain("10:30")
    expect(rows[1]?.textContent).toContain(
      DASHBOARD_OVERVIEW_MESSAGES.ATTENDANCE_PENDING
    )
    expect(rows[2]?.textContent).toContain("18:00")
    expect(rows[2]?.textContent).toContain(CALENDAR_MESSAGES.SUSPENDED_BADGE)
    expect(rows[2]?.textContent).toContain("Feriado")
  })

  it("shows the seal mark only on sealed rows", () => {
    rendered = renderPanel({
      sessions: [
        buildSession({
          start_time: "07:00",
          scheduled_class_id: "class-sealed",
          attendance: { record_count: 5, present_count: 4 },
          can_view_attendance: true,
        }),
        buildSession({
          start_time: "09:00",
          scheduled_class_id: "class-pending",
          can_view_attendance: true,
        }),
      ],
    })

    const rows = rendered.container.querySelectorAll("ul > li")
    expect(rows[0]?.querySelectorAll("svg[aria-label]")).toHaveLength(1)
    expect(rows[1]?.querySelectorAll("svg[aria-label]")).toHaveLength(0)
  })

  it("passes 'Ver asistencia' as the trigger label for sealed rows and the default for pending ones", () => {
    rendered = renderPanel({
      sessions: [
        buildSession({
          start_time: "07:00",
          scheduled_class_id: "class-sealed",
          attendance: { record_count: 5, present_count: 4 },
          can_view_attendance: true,
        }),
        buildSession({
          start_time: "09:00",
          scheduled_class_id: "class-pending",
          can_view_attendance: true,
        }),
      ],
    })

    const calls = dialogSpy.mock.calls.map(
      (call) => call[0] as Record<string, unknown>
    )
    const sealedCall = calls.find(
      (call) => call.scheduledClassId === "class-sealed"
    )
    const pendingCall = calls.find(
      (call) => call.scheduledClassId === "class-pending"
    )
    expect(sealedCall?.triggerLabel).toBe(
      DASHBOARD_OVERVIEW_MESSAGES.VIEW_ATTENDANCE
    )
    expect(pendingCall?.triggerLabel).toBeUndefined()

    const triggers = rendered.container.querySelectorAll(
      '[data-testid="attendance-trigger"]'
    )
    expect(triggers[0]?.textContent).toBe(
      DASHBOARD_OVERVIEW_MESSAGES.VIEW_ATTENDANCE
    )
    expect(triggers[1]?.textContent).toBe(
      ATTENDANCE_FORM_MESSAGES.TAKE_ATTENDANCE
    )
  })

  it("renders the attendance trigger only when can_view_attendance", () => {
    rendered = renderPanel({
      sessions: [
        buildSession({
          start_time: "07:00",
          scheduled_class_id: "class-viewable",
          can_view_attendance: true,
          can_take_attendance: true,
        }),
        buildSession({
          start_time: "09:00",
          scheduled_class_id: "class-hidden",
          can_view_attendance: false,
        }),
      ],
    })

    expect(
      rendered.container.querySelectorAll('[data-testid="attendance-trigger"]')
    ).toHaveLength(1)
    expect(dialogSpy).toHaveBeenCalledTimes(1)
    // Recurring session: scheduledClassId + sessionDate, per session-block.
    expect(dialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledClassId: "class-viewable",
        sessionDate: "2026-10-20",
        branchId: BRANCH_ID,
        disabled: false,
      })
    )
  })

  it("passes oneTimeClassId for one-time classes and disables without can_take_attendance", () => {
    rendered = renderPanel({
      sessions: [
        buildSession({
          start_time: "07:00",
          scheduled_class_id: "one-time-1",
          is_one_time: true,
          can_view_attendance: true,
          can_take_attendance: false,
        }),
      ],
    })

    const call = dialogSpy.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    expect(call?.oneTimeClassId).toBe("one-time-1")
    expect(call?.scheduledClassId).toBeUndefined()
    expect(call?.disabled).toBe(true)
    expect(
      rendered.container
        .querySelector('[data-testid="attendance-trigger"]')
        ?.hasAttribute("disabled")
    ).toBe(true)
  })

  it("renders the empty state with the calendar link", () => {
    rendered = renderPanel({ sessions: [] })

    expect(rendered.container.textContent).toContain(
      CALENDAR_MESSAGES.DAY_EMPTY_STATE
    )
    const links = Array.from(rendered.container.querySelectorAll("a"))
    expect(links.some((link) => link.getAttribute("href") === `/dashboard/calendar?branch=${BRANCH_ID}`)).toBe(
      true
    )
  })

  it("renders the load error as an alert", () => {
    rendered = renderPanel({
      sessions: [],
      loadError: CALENDAR_MESSAGES.LOAD_FAILURE,
    })

    const alert = rendered.container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain(CALENDAR_MESSAGES.LOAD_FAILURE)
    expect(rendered.container.querySelector("ul")).toBeNull()
  })
})
