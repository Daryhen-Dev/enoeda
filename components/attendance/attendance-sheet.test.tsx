// @vitest-environment jsdom

import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ATTENDANCE_FORM_MESSAGES } from "@/lib/localization/es-ec"

const SCHEDULED_CLASS_ID = "aaaaaaaa-1111-2222-8333-444444444444"
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444"
const SESSION_DATE = "2026-09-15"
const ANA_ID = "22222222-3333-4444-8555-666666666661"
const BELO_ID = "22222222-3333-4444-8555-666666666662"
const CARLA_ID = "22222222-3333-4444-8555-666666666663"
const HUGO_ID = "22222222-3333-4444-8555-666666666664"
const DISCIPLINE_ID = "cccccccc-1111-2222-8333-444444444444"

const mocks = vi.hoisted(() => ({
  takeAttendance: vi.fn(),
  addPerClassStudentToSession: vi.fn(),
  listPerClassCandidates: vi.fn(),
  registerClassPayment: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  onSuccess: vi.fn(),
}))

vi.mock("@/lib/domain/attendance/actions", () => ({
  takeAttendance: mocks.takeAttendance,
  addPerClassStudentToSession: mocks.addPerClassStudentToSession,
  listPerClassCandidates: mocks.listPerClassCandidates,
}))
vi.mock("@/lib/domain/payments/actions", () => ({
  registerClassPayment: mocks.registerClassPayment,
}))
vi.mock("@/lib/domain/guests/actions", () => ({
  addGuestToSession: vi.fn(),
  getGuestForConversion: vi.fn(),
  linkGuestToStudent: vi.fn(),
  removeGuestFromSession: vi.fn(),
}))
vi.mock("@/components/students/student-form-dialog", () => ({
  StudentFormDialog: () => null,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}))

import type { SessionAttendanceEntry } from "@/lib/domain/attendance/actions"
import { AttendanceSheet } from "./attendance-sheet"

function entry(
  studentId: string,
  firstName: string,
  overrides: Partial<SessionAttendanceEntry> = {}
): SessionAttendanceEntry {
  return {
    student_id: studentId,
    student_discipline_id: null,
    first_name: firstName,
    surname: "Pérez",
    attended: null,
    observation: null,
    source: "roster",
    billing_mode: "monthly",
    class_payment_registered: false,
    level_name: null,
    level_color: null,
    ...overrides,
  }
}

const BASE_STUDENTS: SessionAttendanceEntry[] = [
  entry(ANA_ID, "Ana"),
  entry(BELO_ID, "Belo"),
  entry(CARLA_ID, "Carla", {
    source: "per_class",
    billing_mode: "per_class",
    student_discipline_id: DISCIPLINE_ID,
  }),
  entry(HUGO_ID, "Hugo", {
    source: "history",
    billing_mode: null,
    attended: true,
  }),
]

// Base UI checkbox clicks dispatch PointerEvent; jsdom lacks it.
if (typeof globalThis.PointerEvent === "undefined") {
  ;(globalThis as unknown as Record<string, unknown>).PointerEvent = MouseEvent
}

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom has no CSS.supports; the belt chip validation needs it.
const realCSS = globalThis.CSS

interface RenderedSheet {
  container: HTMLElement
  unmount(): void
}

function renderSheet(
  students: SessionAttendanceEntry[] = BASE_STUDENTS
): RenderedSheet {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <AttendanceSheet
        scheduledClassId={SCHEDULED_CLASS_ID}
        sessionDate={SESSION_DATE}
        branchId={BRANCH_ID}
        students={students}
        guests={[]}
        onSuccess={mocks.onSuccess}
      />
    )
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

async function flush() {
  await act(async () => {})
  await act(async () => {})
}

function clickButtonWithText(text: string) {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((candidate) => candidate.textContent?.includes(text))
  if (!button) throw new Error(`button "${text}" not found`)
  act(() => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
  })
}

function submitForm() {
  const form = document.querySelector("form")
  if (!form) throw new Error("form not found")
  act(() => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    )
  })
}

function attendedCheckbox(studentId: string): HTMLElement {
  // Base UI renders the visible checkbox as span[role=checkbox] and puts the
  // id on the hidden native input that the row label activates.
  const checkbox = document.querySelector<HTMLElement>(
    `label[for="attended-${studentId}"] [role="checkbox"]`
  )
  if (!checkbox) throw new Error(`checkbox for ${studentId} not found`)
  return checkbox
}

function clickCheckbox(studentId: string) {
  act(() => {
    attendedCheckbox(studentId).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
  })
}

function expectCheckedCount(expected: number) {
  const checked = document.querySelectorAll(
    'label[for^="attended-"] [role="checkbox"][data-checked]'
  )
  expect(checked.length).toBe(expected)
}

describe("AttendanceSheet redesign", () => {
  let rendered: RenderedSheet | undefined

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    setReducedMotion(false)
    ;(globalThis as Record<string, unknown>).CSS = {
      supports: (_prop: string, value: string) => value !== "not-a-color",
    }
  })

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
    globalThis.CSS = realCSS
    vi.useRealTimers()
  })

  it("counts present editable students live, excluding history rows", () => {
    rendered = renderSheet()

    expect(document.body.textContent).toContain("3 de 3 presentes")

    clickCheckbox(ANA_ID)

    expect(attendedCheckbox(ANA_ID).hasAttribute("data-checked")).toBe(false)
    expect(document.body.textContent).toContain("2 de 3 presentes")
  })

  it("marks all editable students absent then present", () => {
    rendered = renderSheet()

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.MARK_ALL_ABSENT)
    expectCheckedCount(0)
    expect(document.body.textContent).toContain("0 de 3 presentes")

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.MARK_ALL_PRESENT)
    expectCheckedCount(3)
    expect(document.body.textContent).toContain("3 de 3 presentes")
  })

  it("toggles attendance from the row label without touching notes", () => {
    rendered = renderSheet()

    expect(attendedCheckbox(ANA_ID).hasAttribute("data-checked")).toBe(true)

    const rowLabel = document.querySelector<HTMLLabelElement>(
      `label[for="attended-${ANA_ID}"]`
    )
    expect(rowLabel).not.toBeNull()
    act(() => {
      rowLabel!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })

    expect(attendedCheckbox(ANA_ID).hasAttribute("data-checked")).toBe(false)

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.ADD_NOTE)
    const observationInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Observación"]'
    )
    expect(observationInput).not.toBeNull()
    // Toggling the note must not toggle attendance.
    expect(attendedCheckbox(ANA_ID).hasAttribute("data-checked")).toBe(false)
  })

  it("renders the belt chip with the level color and name, and neutral without a level", () => {
    rendered = renderSheet([
      entry(BELO_ID, "Belo", {
        level_name: "Cinturón amarillo",
        level_color: "#a1887f",
      }),
      entry(ANA_ID, "Ana"),
    ])

    const coloredChip = rendered.container.querySelector<HTMLElement>(
      'span[title="Cinturón amarillo"]'
    )
    expect(coloredChip).not.toBeNull()
    expect(coloredChip!.style.backgroundColor).not.toBe("")
    expect(document.body.textContent).toContain("Cinturón amarillo")

    const neutralChip = [...rendered.container.querySelectorAll("span")].find(
      (span) =>
        span.className.includes("w-2.5") &&
        span.getAttribute("title") === null &&
        span.style.backgroundColor === ""
    )
    expect(neutralChip).toBeDefined()
  })

  it("renders the belt chip identically without CSS.supports (hydration-safe)", () => {
    // jsdom + the test setup provide CSS.supports; the component must not
    // branch on it: server-rendered trees have no CSS object, so any branch
    // would produce a hydration mismatch and uncolored swatches.
    delete (globalThis as Record<string, unknown>).CSS
    rendered = renderSheet([
      entry(BELO_ID, "Belo", {
        level_name: "Cinturón amarillo",
        level_color: "#a1887f",
      }),
    ])

    const chip = rendered.container.querySelector<HTMLElement>(
      'span[title="Cinturón amarillo"]'
    )
    expect(chip).not.toBeNull()
    expect(chip!.style.backgroundColor).not.toBe("")
  })

  it("keeps the Ausente marker and the source badge outside the tap-target label", () => {
    rendered = renderSheet()

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.MARK_ALL_ABSENT)

    const carlaLabel = document.querySelector<HTMLLabelElement>(
      `label[for="attended-${CARLA_ID}"]`
    )
    expect(carlaLabel).not.toBeNull()
    expect(carlaLabel!.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
    )
    expect(carlaLabel!.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.SOURCE_PER_CLASS
    )

    const carlaRow = carlaLabel!.closest("li")!
    expect(carlaRow.textContent).toContain(
      ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
    )
    expect(carlaRow.textContent).toContain(
      ATTENDANCE_FORM_MESSAGES.SOURCE_PER_CLASS
    )

    // Clicking the meta elements outside the label never toggles attendance.
    const badge = [...carlaRow.querySelectorAll("span")].find(
      (el) => el.textContent === ATTENDANCE_FORM_MESSAGES.SOURCE_PER_CLASS
    )!
    const absentMarker = [...carlaRow.querySelectorAll("span")].find(
      (el) => el.textContent === ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
    )!
    expect(badge).toBeDefined()
    expect(absentMarker).toBeDefined()
    for (const outside of [badge, absentMarker]) {
      act(() => {
        outside.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        )
      })
      expect(
        attendedCheckbox(CARLA_ID).hasAttribute("data-checked")
      ).toBe(false)
    }
  })

  it("shows the Ausente marker on absent editable rows", () => {
    rendered = renderSheet()

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.MARK_ALL_ABSENT)

    const editableLabels = rendered!.container.querySelectorAll(
      'label[for^="attended-"]'
    )
    expect(editableLabels.length).toBe(3)
    editableLabels.forEach((label) => {
      const row = label.closest("li")!
      expect(row.textContent).toContain(
        ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
      )
    })
  })

  it("shows the source badge only for non-roster rows", () => {
    rendered = renderSheet()

    expect(document.body.textContent).toContain(
      ATTENDANCE_FORM_MESSAGES.SOURCE_PER_CLASS
    )
    expect(document.body.textContent).toContain(
      ATTENDANCE_FORM_MESSAGES.SOURCE_HISTORY
    )
    expect(document.body.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.SOURCE_ROSTER
    )
  })

  it("submits the same payload (history excluded) and stamps the seal before refreshing", async () => {
    mocks.takeAttendance.mockResolvedValue({
      success: true,
      data: { saved: 3 },
    })
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    })
    rendered = renderSheet()

    submitForm()
    await flush()

    expect(mocks.takeAttendance).toHaveBeenCalledTimes(1)
    const arg = mocks.takeAttendance.mock.calls[0][0]
    expect(arg).toMatchObject({
      scheduled_class_id: SCHEDULED_CLASS_ID,
      session_date: SESSION_DATE,
      branch_id: BRANCH_ID,
    })
    expect(arg.records).toEqual([
      { student_id: ANA_ID, attended: true, observation: null },
      { student_id: BELO_ID, attended: true, observation: null },
      { student_id: CARLA_ID, attended: true, observation: null },
    ])
    expect(mocks.toastSuccess).toHaveBeenCalled()

    const seal = document.querySelector(
      '[role="img"][aria-label="Asistencia registrada"]'
    )
    expect(seal).not.toBeNull()
    expect(mocks.onSuccess).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(650)
    })

    expect(mocks.refresh).toHaveBeenCalled()
    expect(mocks.onSuccess).toHaveBeenCalledTimes(1)
  })

  it("calls onSuccess immediately under reduced motion", async () => {
    mocks.takeAttendance.mockResolvedValue({
      success: true,
      data: { saved: 3 },
    })
    setReducedMotion(true)
    rendered = renderSheet()

    submitForm()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const seal = document.querySelector(
      '[role="img"][aria-label="Asistencia registrada"]'
    )
    expect(seal).not.toBeNull()
    expect(mocks.refresh).toHaveBeenCalled()
    expect(mocks.onSuccess).toHaveBeenCalledTimes(1)
  })

  it("shows the seal on open for an initially recorded session, hides it while dirty, and restores it when edits are reverted", () => {
    rendered = renderSheet([
      entry(ANA_ID, "Ana", { attended: false }),
      entry(BELO_ID, "Belo"),
    ])

    // Open state equals the stored record: seal, no unsaved marker.
    expect(
      rendered.container.querySelector(
        '[role="img"][aria-label="Asistencia registrada"]'
      )
    ).not.toBeNull()
    expect(document.body.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.UNSAVED_CHANGES
    )

    // Toggling Ana (false -> true) diverges from the stored record.
    clickCheckbox(ANA_ID)
    expect(
      rendered.container.querySelector(
        '[role="img"][aria-label="Asistencia registrada"]'
      )
    ).toBeNull()
    expect(document.body.textContent).toContain(
      ATTENDANCE_FORM_MESSAGES.UNSAVED_CHANGES
    )

    // Toggling back restores the stored state, so the seal returns.
    clickCheckbox(ANA_ID)
    expect(
      rendered.container.querySelector(
        '[role="img"][aria-label="Asistencia registrada"]'
      )
    ).not.toBeNull()
    expect(document.body.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.UNSAVED_CHANGES
    )
  })

  it("shows neither the seal nor the unsaved marker on a fresh session before saving", () => {
    rendered = renderSheet()

    expect(
      rendered.container.querySelector(
        '[role="img"][aria-label="Asistencia registrada"]'
      )
    ).toBeNull()
    expect(document.body.textContent).not.toContain(
      ATTENDANCE_FORM_MESSAGES.UNSAVED_CHANGES
    )
  })

  it("keeps absent row names in foreground ink and shows the Ausente pill", () => {
    rendered = renderSheet()

    clickButtonWithText(ATTENDANCE_FORM_MESSAGES.MARK_ALL_ABSENT)

    const anaLabel = document.querySelector<HTMLLabelElement>(
      `label[for="attended-${ANA_ID}"]`
    )
    expect(anaLabel).not.toBeNull()
    expect(anaLabel!.textContent).toContain("Ana")
    const nameSpan = anaLabel!.querySelector("span span")!
    expect(nameSpan.className).not.toContain("text-muted-foreground")

    const anaRow = anaLabel!.closest("li")!
    const absentMarker = [...anaRow.querySelectorAll("span")].find(
      (el) => el.textContent === ATTENDANCE_FORM_MESSAGES.ATTENDED_STATE_ABSENT
    )!
    expect(absentMarker).toBeDefined()
    expect(absentMarker.className).toContain("text-foreground")
  })
})
