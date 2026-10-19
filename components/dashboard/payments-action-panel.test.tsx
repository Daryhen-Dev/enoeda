// @vitest-environment jsdom

import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { MonthlyPaymentValidationRow } from "@/lib/domain/payments/validation-actions"
import {
  DASHBOARD_OVERVIEW_MESSAGES,
  PAYMENT_VALIDATION_MESSAGES,
} from "@/lib/localization/es-ec"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/lib/domain/payments/validation-actions", () => ({
  getMonthlyPaymentValidation: vi.fn(),
}))

import { PaymentsActionPanel } from "./payments-action-panel"
import type { MonthlyPaymentValidationResult } from "@/lib/domain/payments/validation-actions"

const BRANCH_ID = "bbbbbbbb-1111-2222-3333-444444444444"

function buildRow(
  overrides: Partial<MonthlyPaymentValidationRow> & { student_name: string }
): MonthlyPaymentValidationRow {
  return {
    student_discipline_id: `sd-${overrides.student_name}`,
    student_id: "student-1",
    discipline_name: "Karate",
    days_overdue: 10,
    next_due_date: null,
    grace_deadline: null,
    ...overrides,
  }
}

function buildValidation(
  overrides: Partial<MonthlyPaymentValidationResult> = {}
): MonthlyPaymentValidationResult {
  return {
    today: "2026-10-20",
    month: "2026-10",
    grace_days: 3,
    up_to_date: [],
    in_grace: [],
    to_suspend: [],
    suspended_this_month: [],
    ...overrides,
  }
}

interface RenderedPanel {
  container: HTMLElement
  unmount(): void
}

function renderPanel(props: {
  validation: MonthlyPaymentValidationResult | null
  error: string | null
}): RenderedPanel {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <PaymentsActionPanel branchId={BRANCH_ID} {...props} />
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

describe("PaymentsActionPanel", () => {
  let rendered: RenderedPanel | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
  })

  it("renders the to-suspend group before the in-grace group, with counts", () => {
    rendered = renderPanel({
      validation: buildValidation({
        to_suspend: [buildRow({ student_name: "Ana Zapata" })],
        in_grace: [buildRow({ student_name: "Beto Silva", days_overdue: 2 })],
      }),
      error: null,
    })

    const headings = Array.from(
      rendered.container.querySelectorAll("h4")
    ).map((heading) => heading.textContent)
    expect(headings).toEqual([
      PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND,
      PAYMENT_VALIDATION_MESSAGES.IN_GRACE,
    ])

    const counts = Array.from(
      rendered.container.querySelectorAll("h4 + span, h4 ~ span")
    )
    // The to-suspend count carries the destructive tone, in-grace stays muted.
    expect(counts[0]?.className).toContain("text-destructive")
    expect(counts[1]?.className).not.toContain("text-destructive")
  })

  it("caps each group at five rows", () => {
    rendered = renderPanel({
      validation: buildValidation({
        to_suspend: Array.from({ length: 7 }, (_, index) =>
          buildRow({ student_name: `Suspendido ${index}` })
        ),
        in_grace: Array.from({ length: 6 }, (_, index) =>
          buildRow({ student_name: `En gracia ${index}` })
        ),
      }),
      error: null,
    })

    const groups = rendered.container.querySelectorAll("ul")
    expect(groups[0]?.querySelectorAll("li")).toHaveLength(5)
    expect(groups[1]?.querySelectorAll("li")).toHaveLength(5)
    expect(rendered.container.textContent).not.toContain("Suspendido 5")
  })

  it("renders overdue days and the grace deadline for in-grace rows", () => {
    rendered = renderPanel({
      validation: buildValidation({
        in_grace: [
          buildRow({
            student_name: "Beto Silva",
            days_overdue: 1,
            grace_deadline: "2026-10-25",
          }),
        ],
      }),
      error: null,
    })

    expect(rendered.container.textContent).toContain(
      DASHBOARD_OVERVIEW_MESSAGES.DAYS_OVERDUE_COUNT(1)
    )
    expect(rendered.container.textContent).toContain("25 de octubre")
  })

  it("shows the empty-group text for groups without rows", () => {
    rendered = renderPanel({
      validation: buildValidation(),
      error: null,
    })

    expect(rendered.container.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.TO_SUSPEND_EMPTY
    )
    expect(rendered.container.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.IN_GRACE_EMPTY
    )
  })

  it("links to the monthly validation page with the encoded branch", () => {
    rendered = renderPanel({
      validation: buildValidation(),
      error: null,
    })

    const link = rendered.container.querySelector(
      `a[href="/dashboard/payments/validation?branch=${BRANCH_ID}"]`
    )
    expect(link?.textContent).toContain(
      DASHBOARD_OVERVIEW_MESSAGES.VALIDATION_LINK
    )
  })

  it("renders the service-unavailable alert on load failure", () => {
    rendered = renderPanel({ validation: null, error: null })

    const alert = rendered.container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain(
      PAYMENT_VALIDATION_MESSAGES.SERVICE_UNAVAILABLE
    )
  })
})
