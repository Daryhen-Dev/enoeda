// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  CALENDAR_MESSAGES,
  DASHBOARD_OVERVIEW_MESSAGES,
  ROSTER_EDITOR_MESSAGES,
} from "@/lib/localization/es-ec";
import { cn } from "@/lib/utils";

const SCHEDULED_CLASS_ID = "aaaaaaaa-1111-2222-8333-444444444444";
const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const TEACHER_ID = "dddddddd-1111-2222-8333-444444444444";
const SESSION_DATE = "2026-09-15";

const mocks = vi.hoisted(() => ({
  reinstateSession: vi.fn(),
  clearSessionSubstitution: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/classes/actions", () => ({
  reinstateSession: mocks.reinstateSession,
  clearSessionSubstitution: mocks.clearSessionSubstitution,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// The collaborators are irrelevant here except for the classes they are
// handed: echo the trigger so the action vocabulary can be asserted.
vi.mock("@/components/attendance/attendance-sheet-dialog", () => ({
  AttendanceSheetDialog: ({
    triggerClassName,
    disabled,
    triggerLabel,
  }: {
    triggerClassName?: string;
    disabled?: boolean;
    triggerLabel?: string;
  }) => (
    <button
      type="button"
      data-testid="attendance-trigger"
      className={triggerClassName}
      disabled={disabled}
    >
      {triggerLabel ?? "Tomar asistencia"}
    </button>
  ),
}));
vi.mock("@/components/classes/session-suspend-dialog", () => ({
  SessionSuspendDialog: ({
    triggerClassName,
    trigger,
  }: {
    triggerClassName?: string;
    trigger?: React.ReactNode;
  }) => (
    <button type="button" data-testid="suspend-trigger" className={triggerClassName}>
      {trigger}
    </button>
  ),
}));
vi.mock("@/components/classes/remove-recurring-class-dialog", () => ({
  RemoveRecurringClassDialog: ({
    triggerClassName,
  }: {
    triggerClassName?: string;
  }) => (
    <button type="button" data-testid="remove-trigger" className={triggerClassName} />
  ),
}));
vi.mock("@/components/attendance/session-info-sheet-dialog", () => ({
  SessionInfoSheetDialog: () => null,
}));
vi.mock("@/components/classes/teacher-assign-dialog", () => ({
  TeacherAssignDialog: () => null,
}));
vi.mock("@/components/classes/one-time-teacher-dialog", () => ({
  OneTimeTeacherDialog: () => null,
}));
vi.mock("@/components/rosters/roster-editor-sheet", () => ({
  RosterEditorSheet: () => null,
}));

import { SessionBlock } from "./session-block";
import type { SessionView } from "@/lib/domain/classes/actions";

if (typeof globalThis.PointerEvent === "undefined") {
  (
    globalThis as unknown as Record<string, unknown>
  ).PointerEvent = MouseEvent;
}
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * S3 forbids the Tailwind palette in the session block: state comes from the
 * semantic tokens of DESIGN.md only.
 */
const PALETTE_UTILITY =
  /^(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow|decoration|accent|caret|placeholder)-(?:sky|blue|amber|purple|emerald|slate|gray|grey|red|green|zinc|neutral|stone)-\d{2,3}(?:\/\d+)?$/;

/**
 * The block may reuse the shared Button and Badge primitives, and those
 * primitives ship inert `dark:` variants of their own (documented in
 * `app/globals.css`). The block itself must not author any `dark:` variant,
 * so anything not produced by those primitives is a leftover.
 */
function primitiveDarkClasses(): Set<string> {
  const variants = [
    "default",
    "outline",
    "secondary",
    "ghost",
    "destructive",
    "link",
  ] as const;
  const sizes = ["default", "sm"] as const;
  const badgeVariantsList = ["default", "secondary", "outline"] as const;

  return new Set(
    [
      ...variants.flatMap((variant) =>
        sizes.flatMap((size) => buttonVariants({ variant, size }).split(/\s+/))
      ),
      ...badgeVariantsList.flatMap((variant) =>
        badgeVariants({ variant }).split(/\s+/)
      ),
    ].filter((token) => token.includes("dark:"))
  );
}

function buildSession(overrides: Partial<SessionView> = {}): SessionView {
  return {
    scheduled_class_id: SCHEDULED_CLASS_ID,
    session_date: SESSION_DATE,
    discipline_id: "cccccccc-1111-2222-8333-444444444444",
    discipline_name: "Karate",
    discipline_code: "karate",
    start_time: "17:00",
    end_time: "18:00",
    teacher_id: TEACHER_ID,
    effective_teacher_name: "María Pérez",
    can_view_attendance: true,
    can_take_attendance: true,
    status: "scheduled",
    suspension_category: null,
    suspension_reason: null,
    is_substitute: false,
    is_one_time: false,
    series_id: "99999999-8888-7777-8666-555555555555",
    series_name: "Karate mensual",
    period_month: "2026-09",
    attendance: { record_count: 0, present_count: 0 },
    ...overrides,
  };
}

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderBlock(session: SessionView, compact = false): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SessionBlock
        session={session}
        compact={compact}
        teachers={[{ id: TEACHER_ID, name: "María Pérez" }]}
        canManage
        branchId={BRANCH_ID}
      />
    );
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function allClassTokens(scope: ParentNode): string[] {
  return [...scope.querySelectorAll<HTMLElement>("*")].flatMap((element) =>
    (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)
  );
}

function classTokensOf(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function card(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[role="group"]');
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("SessionBlock design tokens (S3)", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders no Tailwind palette utility in the full block", () => {
    rendered = renderBlock(buildSession());

    expect(allClassTokens(document).filter((token) => PALETTE_UTILITY.test(token)))
      .toEqual([]);
  });

  it("renders no Tailwind palette utility in the compact block", () => {
    rendered = renderBlock(buildSession(), true);

    expect(allClassTokens(document).filter((token) => PALETTE_UTILITY.test(token)))
      .toEqual([]);
  });

  it("authors no dark: variant of its own in either density", () => {
    const allowed = primitiveDarkClasses();

    rendered = renderBlock(buildSession());
    const fullLeftovers = allClassTokens(document)
      .filter((token) => token.includes("dark:"))
      .filter((token) => !allowed.has(token));

    rendered.unmount();
    rendered = renderBlock(buildSession(), true);
    const compactLeftovers = allClassTokens(document)
      .filter((token) => token.includes("dark:"))
      .filter((token) => !allowed.has(token));

    expect([...fullLeftovers, ...compactLeftovers]).toEqual([]);
  });

  it("prints a suspended session in retired grey with the shared word", () => {
    rendered = renderBlock(buildSession({ status: "suspended" }));
    const tokens = classTokensOf(card());

    expect(tokens).toContain("bg-muted");
    expect(tokens).toContain("border-border");
    expect(tokens).toContain("text-muted-foreground");
    expect(card().textContent).toContain(CALENDAR_MESSAGES.SUSPENDED_BADGE);
  });

  it("seals an attended session with the seal token and its count", () => {
    rendered = renderBlock(
      buildSession({ attendance: { record_count: 12, present_count: 10 } })
    );
    const tokens = allClassTokens(document);

    expect(tokens).toContain("border-seal/40");
    expect(tokens).toContain("bg-seal/5");
    expect(tokens).toContain("text-seal");
    expect(card().textContent).toContain(
      CALENDAR_MESSAGES.ATTENDANCE_PRESENT_COUNT(10)
    );
  });

  it("marks a scheduled session with the agenda's pending pill", () => {
    rendered = renderBlock(buildSession());
    const pill = [...document.querySelectorAll<HTMLElement>("span")].find(
      (element) =>
        element.textContent === DASHBOARD_OVERVIEW_MESSAGES.ATTENDANCE_PENDING
    );
    const tokens = classTokensOf(pill ?? null);

    expect(pill).not.toBeNull();
    expect(tokens).toContain("border");
    expect(tokens).toContain("border-border");
    expect(tokens).toContain("text-xs");
    expect(tokens).not.toContain("text-seal");
  });

  it("renders a one-time session with the outline badge and a substitute with the secondary badge", () => {
    rendered = renderBlock(buildSession({ is_substitute: true }));

    const secondary = [...document.querySelectorAll<HTMLElement>('[data-slot="badge"]')]
      .map(classTokensOf)
      .filter((tokens) => tokens.includes("bg-secondary"));
    expect(secondary).toHaveLength(1);

    rendered.unmount();
    rendered = renderBlock(
      buildSession({
        is_substitute: false,
        is_one_time: true,
        series_id: undefined,
        series_name: undefined,
        period_month: undefined,
      })
    );
    const outline = [...document.querySelectorAll<HTMLElement>('[data-slot="badge"]')]
      .map(classTokensOf)
      .filter((tokens) => tokens.includes("border-border"));
    expect(outline).toHaveLength(1);
  });

  it("keeps the action variants of the shared button primitive", () => {
    rendered = renderBlock(buildSession());

    expect(classTokensOf(document.querySelector('[data-testid="attendance-trigger"]')))
      .toEqual(buttonVariants({ variant: "default", size: "sm" }).split(/\s+/));
    const destructive = cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      "text-destructive"
    ).split(/\s+/);
    expect(classTokensOf(document.querySelector('[data-testid="suspend-trigger"]')))
      .toEqual(destructive);
    expect(classTokensOf(document.querySelector('[data-testid="remove-trigger"]')))
      .toEqual(destructive);

    const rosterButton = [...document.querySelectorAll<HTMLElement>("button")].find(
      (element) =>
        element.textContent === ROSTER_EDITOR_MESSAGES.ROSTER_SERIES_ACTION
    );
    const rosterTokens = classTokensOf(rosterButton ?? null);
    expect(rosterTokens).toEqual(
      cn(buttonVariants({ variant: "outline", size: "sm" })).split(/\s+/)
    );
  });
});
