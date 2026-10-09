// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TEACHER_ASSIGN_MESSAGES,
} from "@/lib/localization/es-ec";

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

// Calendar block collaborators are irrelevant here; stub them out.
vi.mock("@/components/attendance/attendance-sheet-dialog", () => ({
  AttendanceSheetDialog: () => null,
}));
vi.mock("@/components/attendance/session-info-sheet-dialog", () => ({
  SessionInfoSheetDialog: () => null,
}));
vi.mock("@/components/classes/remove-recurring-class-dialog", () => ({
  RemoveRecurringClassDialog: () => null,
}));
vi.mock("@/components/classes/session-suspend-dialog", () => ({
  SessionSuspendDialog: () => null,
}));
vi.mock("@/components/classes/teacher-assign-dialog", () => ({
  TeacherAssignDialog: () => null,
}));
vi.mock("@/components/classes/one-time-teacher-dialog", () => ({
  OneTimeTeacherDialog: ({ trigger }: { trigger?: React.ReactNode }) => (
    <button type="button" data-testid="one-time-teacher-stub">
      {trigger ?? "one-time-teacher"}
    </button>
  ),
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
// SessionBlock's card click handlers read the mobile viewport; jsdom has
// no matchMedia and desktop (false) matches the button-click path.
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

function buildSession(
  overrides: Partial<SessionView> = {}
): SessionView {
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
    is_substitute: true,
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

function renderBlock(
  session: SessionView,
  options: { canManage?: boolean } = {}
): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SessionBlock
        session={session}
        teachers={[{ id: TEACHER_ID, name: "María Pérez" }]}
        canManage={options.canManage ?? true}
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

function queryClearSubstitutionButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `button[aria-label="${TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_TRIGGER_ARIA_LABEL(
      SESSION_DATE
    )}"]`
  );
}

function queryOneTimeTeacherStub(): HTMLElement | null {
  return document.querySelector('[data-testid="one-time-teacher-stub"]');
}

async function confirmClearSubstitution() {
  const confirmButton = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-slot="alert-dialog-content"] button'
    ),
  ].find((button) =>
    button.textContent?.includes(
      TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_CONFIRM
    )
  );
  expect(confirmButton).toBeDefined();

  await act(async () => {
    confirmButton?.click();
  });
  await act(async () => {});
}

describe("SessionBlock teacher substitution actions", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.clearSessionSubstitution.mockResolvedValue({
      success: true,
      data: { cleared: true },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders 'Quitar sustitución' only for recurring sessions with an active substitution and canManage", () => {
    rendered = renderBlock(buildSession({ is_substitute: true }));
    expect(queryClearSubstitutionButton()).not.toBeNull();

    rendered.unmount();
    rendered = renderBlock(buildSession({ is_substitute: false }));
    expect(queryClearSubstitutionButton()).toBeNull();

    rendered.unmount();
    rendered = renderBlock(
      buildSession({ is_substitute: true }),
      { canManage: false }
    );
    expect(queryClearSubstitutionButton()).toBeNull();
  });

  it("shows the confirmation copy and calls clearSessionSubstitution after confirm", async () => {
    rendered = renderBlock(buildSession({ is_substitute: true }));

    act(() => {
      queryClearSubstitutionButton()?.click();
    });

    const dialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    );
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(
      TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_TITLE
    );
    expect(dialog?.textContent).toContain(
      TEACHER_ASSIGN_MESSAGES.CLEAR_SUBSTITUTION_DESCRIPTION
    );

    await confirmClearSubstitution();

    expect(mocks.clearSessionSubstitution).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      scheduled_class_id: SCHEDULED_CLASS_ID,
      session_date: SESSION_DATE,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TEACHER_ASSIGN_MESSAGES.SUBSTITUTION_CLEARED
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(
      document.querySelector('[data-slot="alert-dialog-content"]')
    ).toBeNull();
  });

  it("reports SUBSTITUTION_NONE when there was nothing to clear", async () => {
    mocks.clearSessionSubstitution.mockResolvedValue({
      success: true,
      data: { cleared: false },
    });
    rendered = renderBlock(buildSession({ is_substitute: true }));

    act(() => {
      queryClearSubstitutionButton()?.click();
    });
    await confirmClearSubstitution();

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TEACHER_ASSIGN_MESSAGES.SUBSTITUTION_NONE
    );
  });

  it("shows the error toast when clearing fails", async () => {
    mocks.clearSessionSubstitution.mockResolvedValue({
      success: false,
      error: TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED,
    });
    rendered = renderBlock(buildSession({ is_substitute: true }));

    act(() => {
      queryClearSubstitutionButton()?.click();
    });
    await confirmClearSubstitution();

    expect(mocks.toastError).toHaveBeenCalledWith(
      TEACHER_ASSIGN_MESSAGES.UNAUTHORIZED
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renders the one-time teacher action for one-time sessions with canManage only", () => {
    rendered = renderBlock(
      buildSession({
        is_one_time: true,
        is_substitute: false,
        series_id: undefined,
        series_name: undefined,
        period_month: undefined,
      })
    );
    expect(queryOneTimeTeacherStub()).not.toBeNull();

    rendered.unmount();
    rendered = renderBlock(
      buildSession({
        is_one_time: true,
        is_substitute: false,
        series_id: undefined,
        series_name: undefined,
        period_month: undefined,
      }),
      { canManage: false }
    );
    expect(queryOneTimeTeacherStub()).toBeNull();

    rendered.unmount();
    rendered = renderBlock(buildSession({ is_one_time: false }));
    expect(queryOneTimeTeacherStub()).toBeNull();
  });
});
