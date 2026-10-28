// @vitest-environment jsdom

/**
 * StudentRowActions — S2 contract.
 *
 * Every row action of the students directory is reachable from one "Acciones"
 * menu: the detail link, one payment item per active discipline, edit, activate,
 * deactivate and reactivate. Selecting an item opens its dialog once, outside
 * the menu popup.
 */

import { act } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STUDENT_LIFECYCLE_MESSAGES,
  STUDENT_ROW_ACTIONS_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const ANA_ID = "cccccccc-1111-4222-8333-444444444444";
const PENDING_ID = "cccccccc-2222-4222-8333-444444444445";
const INACTIVE_ID = "cccccccc-3333-4222-8333-444444444446";

const KARATE_DISCIPLINE_ID = "dddddddd-1111-4222-8333-444444444444";
const AJEDREZ_DISCIPLINE_ID = "dddddddd-2222-4222-8333-444444444445";

const mocks = vi.hoisted(() => ({
  activateStudent: vi.fn(),
  deactivateStudent: vi.fn(),
  reactivateStudent: vi.fn(),
  registerMonthlyPayment: vi.fn(),
  registerClassPayment: vi.fn(),
  createStudent: vi.fn(),
  findStudentsWithSameName: vi.fn(),
  getStudentById: vi.fn(),
  updateStudent: vi.fn(),
  enrollStudent: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/lib/domain/students", async () => {
  const { getMissingStudentData, hasIncompleteStudentData } = await import(
    "@/lib/domain/students/completeness"
  );

  return {
    getMissingStudentData,
    hasIncompleteStudentData,
    activateStudent: mocks.activateStudent,
    reactivateStudent: mocks.reactivateStudent,
    STUDENT_STATUS: { ACTIVE: "active", INACTIVE: "inactive" },
    STUDENT_ACTIVATION_STATUS: { PENDING: "pending", ACTIVE: "active" },
  };
});

vi.mock("@/lib/domain/students/actions", () => ({
  deactivateStudent: mocks.deactivateStudent,
  createStudent: mocks.createStudent,
  findStudentsWithSameName: mocks.findStudentsWithSameName,
  getStudentById: mocks.getStudentById,
  updateStudent: mocks.updateStudent,
}));

vi.mock("@/lib/domain/payments/actions", () => ({
  registerMonthlyPayment: mocks.registerMonthlyPayment,
  registerClassPayment: mocks.registerClassPayment,
}));

vi.mock("@/lib/domain/disciplines/actions", () => ({
  enrollStudent: mocks.enrollStudent,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

/**
 * Lightweight stand-in for the Base UI dropdown wrapper.
 *
 * Opening a real `Menu` popup under jsdom leaks floating-ui positioning timers:
 * a single open costs seconds and the worker eventually dies, which says
 * nothing about this component. The double keeps the contract the component
 * relies on (trigger toggles, content is only rendered while open, an item
 * click closes the popup) so the assertions stay about the action list.
 */
vi.mock("@/components/ui/dropdown-menu", async () => {
  const { cloneElement, createContext, useContext, useState } = await import(
    "react"
  );

  interface MenuState {
    open: boolean;
    toggle: () => void;
    close: () => void;
  }

  const MenuContext = createContext<MenuState>({
    open: false,
    toggle: () => {},
    close: () => {},
  });

  function DropdownMenu({ children }: { children?: ReactNode }) {
    const [open, setIsOpen] = useState(false);

    return (
      <MenuContext.Provider
        value={{
          open,
          toggle: () => setIsOpen((current) => !current),
          close: () => setIsOpen(false),
        }}
      >
        {children}
      </MenuContext.Provider>
    );
  }

  function DropdownMenuTrigger({
    render,
    children,
  }: {
    render?: ReactElement;
    children?: ReactNode;
  }) {
    const { toggle } = useContext(MenuContext);

    if (!render) return null;

    // Base UI merges the trigger props into the rendered element.
    return cloneElement(
      render as unknown as ReactElement<Record<string, unknown>>,
      { onClick: toggle },
      children
    );
  }

  function DropdownMenuContent({ children }: { children?: ReactNode }) {
    const { open } = useContext(MenuContext);

    return open ? <div data-slot="dropdown-menu-content">{children}</div> : null;
  }

  function DropdownMenuGroup({ children }: { children?: ReactNode }) {
    return <div data-slot="dropdown-menu-group">{children}</div>;
  }

  function DropdownMenuItem({
    render,
    children,
    onClick,
  }: {
    render?: ReactElement;
    children?: ReactNode;
    onClick?: (event: ReactMouseEvent) => void;
  }) {
    const { close } = useContext(MenuContext);

    function handleClick(event: ReactMouseEvent) {
      onClick?.(event);
      // Base UI closes the popup on click (closeOnClick defaults to true).
      close();
    }

    if (render) {
      return cloneElement(
        render as unknown as ReactElement<Record<string, unknown>>,
        { onClick: handleClick, "data-slot": "dropdown-menu-item" },
        children
      );
    }

    return (
      <button type="button" data-slot="dropdown-menu-item" onClick={handleClick}>
        {children}
      </button>
    );
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
  };
});

import { StudentActivateDialog } from "./student-activate-dialog";
import { StudentDeactivateDialog } from "./student-deactivate-dialog";
import { StudentReactivateDialog } from "./student-reactivate-dialog";
import { StudentRowActions } from "./student-row-actions";

const BRANCHES = [{ id: BRANCH_ID, name: "Sucursal Norte" }];

function makeStudent(overrides: {
  id: string;
  first_name: string;
  surname: string;
  activation_status?: "active" | "pending";
  active_disciplines?: {
    id: string;
    discipline_name: string;
    next_due_date: string | null;
    billing_mode: "monthly" | "per_class";
    level_name?: string | null;
    level_color?: string | null;
  }[];
}) {
  const activeDisciplines = overrides.active_disciplines ?? [];

  return {
    id: overrides.id,
    branch_id: BRANCH_ID,
    first_name: overrides.first_name,
    surname: overrides.surname,
    national_id: "1712345678",
    email: "ana@example.com",
    date_of_birth: null,
    activation_status: overrides.activation_status ?? "active",
    active_discipline_names: activeDisciplines.map(
      (discipline) => discipline.discipline_name
    ),
    active_disciplines: activeDisciplines.map((discipline) => ({
      level_name: null,
      level_color: null,
      ...discipline,
    })),
  };
}

/** Ana: active record carrying one monthly and one per-class enrollment. */
const ANA = makeStudent({
  id: ANA_ID,
  first_name: "Ana",
  surname: "Pérez",
  active_disciplines: [
    {
      id: KARATE_DISCIPLINE_ID,
      discipline_name: "Karate",
      next_due_date: "2026-03-05",
      billing_mode: "monthly",
    },
    {
      id: AJEDREZ_DISCIPLINE_ID,
      discipline_name: "Ajedrez",
      next_due_date: null,
      billing_mode: "per_class",
    },
  ],
});

/** Bruno: registered but still pending activation. */
const BRUNO = makeStudent({
  id: PENDING_ID,
  first_name: "Bruno",
  surname: "Díaz",
  activation_status: "pending",
});

/** Carla: inactive record, visible in the history tab. */
const CARLA = makeStudent({
  id: INACTIVE_ID,
  first_name: "Carla",
  surname: "Ruiz",
});

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderRowActions(
  student: ReturnType<typeof makeStudent>,
  options: { status?: "active" | "inactive"; canManage?: boolean } = {}
): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <StudentRowActions
        student={student}
        branchId={BRANCH_ID}
        branches={BRANCHES}
        status={options.status ?? "active"}
        canManage={options.canManage ?? true}
        onActivated={vi.fn()}
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

function queryTrigger(container: HTMLElement): HTMLButtonElement {
  const trigger = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${STUDENT_ROW_ACTIONS_MESSAGES.TRIGGER_ARIA(
      "Ana Pérez"
    )}"]`
  );
  // The trigger is named after the student so a screen reader can tell rows apart.
  const anyTrigger = container.querySelector<HTMLButtonElement>("button");
  return trigger ?? anyTrigger!;
}

function openMenu(container: HTMLElement) {
  act(() => {
    queryTrigger(container).click();
  });

  return queryMenuItems();
}

function queryMenuItems(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-slot="dropdown-menu-item"]'
    ),
  ];
}

function queryMenuLabels(): string[] {
  return queryMenuItems().map((item) => (item.textContent ?? "").trim());
}

function queryMenuItem(label: string): HTMLElement | undefined {
  return queryMenuItems().find(
    (item) => (item.textContent ?? "").trim() === label
  );
}

async function selectItem(label: string) {
  const item = queryMenuItem(label);
  expect(item).toBeDefined();

  await act(async () => {
    item!.click();
  });
  // Dialog effects (e.g. loading the edited student) settle in microtasks.
  await act(async () => {});
}

function queryDialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="alert-dialog-content"]'
  );
}

function querySheetContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
}

describe("StudentRowActions — one Acciones menu per row", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.activateStudent.mockResolvedValue({ success: true, data: {} });
    mocks.deactivateStudent.mockResolvedValue({ success: true, data: {} });
    mocks.reactivateStudent.mockResolvedValue({ success: true, data: {} });
    mocks.getStudentById.mockResolvedValue({
      success: true,
      data: {
        id: ANA_ID,
        branch_id: BRANCH_ID,
        first_name: "Ana",
        surname: "Pérez",
        national_id: null,
        email: null,
        phone: null,
        date_of_birth: null,
        is_active: true,
      },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    // Popups portal into <body>; drop whatever a failed assertion left behind.
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("names the trigger after the student", () => {
    rendered = renderRowActions(ANA);

    const trigger = rendered.container.querySelector("button");
    expect(trigger?.getAttribute("aria-label")).toBe(
      STUDENT_ROW_ACTIONS_MESSAGES.TRIGGER_ARIA("Ana Pérez")
    );
    // Collapsed by default: the menu is not rendered until asked for.
    expect(queryMenuItems()).toHaveLength(0);
  });

  it("exposes every previous action with one payment item per discipline", async () => {
    rendered = renderRowActions(ANA);

    openMenu(rendered.container);

    expect(queryMenuLabels()).toEqual([
      STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL,
      STUDENT_ROW_ACTIONS_MESSAGES.MONTHLY_PAYMENT("Karate"),
      STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT("Karate"),
      STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT("Ajedrez"),
      STUDENT_ROW_ACTIONS_MESSAGES.EDIT,
      STUDENT_ROW_ACTIONS_MESSAGES.DEACTIVATE,
    ]);

    // The per-class enrollment never gets a monthly item.
    expect(queryMenuLabels()).not.toContain(
      STUDENT_ROW_ACTIONS_MESSAGES.MONTHLY_PAYMENT("Ajedrez")
    );
  });

  it("keeps the detail one tap away from the menu", async () => {
    rendered = renderRowActions(ANA);

    openMenu(rendered.container);

    const detailItem = queryMenuItem(STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL);
    const link = detailItem?.querySelector("a") ?? detailItem?.closest("a");
    expect(link?.getAttribute("href")).toBe(
      `/dashboard/students/${ANA_ID}?branch=${BRANCH_ID}`
    );
  });

  it("offers Activar instead of Desactivar while the record is pending", async () => {
    rendered = renderRowActions(BRUNO);

    openMenu(rendered.container);

    expect(queryMenuLabels()).toContain(STUDENT_ROW_ACTIONS_MESSAGES.ACTIVATE);
    // Parity with the previous cell: a pending record could still be deactivated.
    expect(queryMenuLabels()).toContain(
      STUDENT_ROW_ACTIONS_MESSAGES.DEACTIVATE
    );
  });

  it("offers Reactivar and no Desactivar in the history tab", async () => {
    rendered = renderRowActions(CARLA, { status: "inactive" });

    openMenu(rendered.container);

    expect(queryMenuLabels()).toEqual([
      STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL,
      STUDENT_ROW_ACTIONS_MESSAGES.REACTIVATE,
    ]);
  });

  it("hides Activar from a read-only user on a pending record", async () => {
    rendered = renderRowActions(BRUNO, { canManage: false });

    openMenu(rendered.container);

    expect(queryMenuLabels()).toEqual([
      STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL,
      STUDENT_ROW_ACTIONS_MESSAGES.EDIT,
    ]);
  });

  it("hides the monthly payment item from a read-only user but keeps the class one", async () => {
    rendered = renderRowActions(ANA, { canManage: false });

    openMenu(rendered.container);

    expect(queryMenuLabels()).toEqual([
      STUDENT_ROW_ACTIONS_MESSAGES.VIEW_DETAIL,
      STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT("Karate"),
      STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT("Ajedrez"),
      STUDENT_ROW_ACTIONS_MESSAGES.EDIT,
    ]);
  });

  const DIALOG_CASES: [
    string,
    "alert" | "sheet",
    ReturnType<typeof makeStudent>,
  ][] = [
    [STUDENT_ROW_ACTIONS_MESSAGES.ACTIVATE, "alert", BRUNO],
    [STUDENT_ROW_ACTIONS_MESSAGES.DEACTIVATE, "alert", ANA],
    [STUDENT_ROW_ACTIONS_MESSAGES.MONTHLY_PAYMENT("Karate"), "sheet", ANA],
    [STUDENT_ROW_ACTIONS_MESSAGES.CLASS_PAYMENT("Karate"), "sheet", ANA],
    [STUDENT_ROW_ACTIONS_MESSAGES.EDIT, "sheet", ANA],
  ];

  it.each(DIALOG_CASES)(
    "opens the %s dialog once and closes the menu",
    async (label, kind, student) => {
      rendered = renderRowActions(student);

      openMenu(rendered.container);
      expect(queryDialogContent()).toBeNull();
      expect(querySheetContent()).toBeNull();

      await selectItem(label);

      const content =
        kind === "alert" ? queryDialogContent() : querySheetContent();
      expect(content).not.toBeNull();
      expect(document.querySelectorAll('[data-slot="alert-dialog-content"]').length)
        .toBeLessThanOrEqual(1);
      expect(document.querySelectorAll('[data-slot="sheet-content"]').length)
        .toBeLessThanOrEqual(1);
      // The popup closes so the dialog is never nested inside the menu.
      expect(queryMenuItems()).toHaveLength(0);
    }
  );

  it("opens the reactivation dialog from the history tab", async () => {
    rendered = renderRowActions(CARLA, { status: "inactive" });

    openMenu(rendered.container);
    await selectItem(STUDENT_ROW_ACTIONS_MESSAGES.REACTIVATE);

    expect(queryDialogContent()?.textContent).toContain(
      STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_CONFIRMATION_TITLE
    );
    expect(queryMenuItems()).toHaveLength(0);
  });

  it("names the confirmation after the student when activating", async () => {
    rendered = renderRowActions(BRUNO);

    openMenu(rendered.container);
    await selectItem(STUDENT_ROW_ACTIONS_MESSAGES.ACTIVATE);

    expect(queryDialogContent()?.textContent).toContain(
      STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_CONFIRMATION_TITLE("Bruno Díaz")
    );
  });
});


/**
 * Additivity guard: the new optional props must not change the standalone
 * usage of the lifecycle dialogs — same trigger, same copy.
 */
describe("Student lifecycle dialogs — uncontrolled parity", () => {
  const STUDENT = { id: ANA_ID, first_name: "Ana", surname: "Pérez", branch_id: BRANCH_ID };

  it("keeps its own trigger when the controlled props are omitted", async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <>
          <StudentActivateDialog
            student={STUDENT}
            branchId={BRANCH_ID}
            onActivated={vi.fn()}
          />
          <StudentDeactivateDialog student={STUDENT} branchId={BRANCH_ID} />
          <StudentReactivateDialog
            student={STUDENT}
            branches={BRANCHES}
            callerBranchId={BRANCH_ID}
          />
        </>
      );
    });

    const triggerLabels = [...container.querySelectorAll("button")].map(
      (button) => (button.textContent ?? "").trim()
    );
    expect(triggerLabels).toEqual([
      STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_TRIGGER,
      STUDENT_LIFECYCLE_MESSAGES.DEACTIVATE_TRIGGER,
      STUDENT_LIFECYCLE_MESSAGES.REACTIVATE_TRIGGER,
    ]);
    expect(queryDialogContent()).toBeNull();

    await act(async () => {
      container.querySelector("button")?.click();
    });
    await act(async () => {});

    expect(queryDialogContent()?.textContent).toContain(
      STUDENT_LIFECYCLE_MESSAGES.ACTIVATE_CONFIRMATION_TITLE("Ana Pérez")
    );

    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });
});
