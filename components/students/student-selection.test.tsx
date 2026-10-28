// @vitest-environment jsdom

/**
 * Student selection — S4 bulk contract.
 *
 * Selecting students in the directory (cards below `md`, the table above) is
 * what turns "deactivate" into a batch: the bar counts the selection, opens the
 * shared confirmation, and clears itself so a hidden row can never be
 * deactivated. A caller who cannot manage the branch gets no checkboxes at all.
 */

import { useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EcuadorTimeZone } from "@/lib/domain/branches/schema";
import { STUDENT_BULK_ACTIONS_MESSAGES } from "@/lib/localization/es-ec";

// jsdom does not implement PointerEvent; Base UI's checkbox dispatches one on
// click, so fall back to MouseEvent before rendering anything.
if (typeof globalThis.PointerEvent === "undefined") {
  (globalThis as unknown as Record<string, unknown>).PointerEvent = MouseEvent;
}

const BRANCH_ID = "bbbbbbbb-1111-4222-8333-444444444444";
const ANA_ID = "cccccccc-1111-4222-8333-444444444441";
const BRUNO_ID = "cccccccc-2222-4222-8333-444444444442";
const TIME_ZONE: EcuadorTimeZone = "America/Guayaquil";

const mocks = vi.hoisted(() => ({
  activateStudent: vi.fn(),
  deactivateStudent: vi.fn(),
  deactivateStudents: vi.fn(),
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
  activateStudent: mocks.activateStudent,
  deactivateStudent: mocks.deactivateStudent,
  deactivateStudents: mocks.deactivateStudents,
  reactivateStudent: mocks.reactivateStudent,
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

import { BulkDeactivateDialog } from "./bulk-deactivate-dialog";
import { StudentCard } from "./student-card";
import { getStudentColumns } from "./student-columns";
import { StudentSelectionBar } from "./student-selection";

const BRANCHES = [{ id: BRANCH_ID, name: "Sucursal Norte" }];

function makeStudent(id: string, firstName: string, surname: string) {
  return {
    id,
    branch_id: BRANCH_ID,
    first_name: firstName,
    surname,
    national_id: "1712345678",
    email: `${firstName.toLowerCase()}@example.com`,
    date_of_birth: new Date("2010-05-04T00:00:00.000Z"),
    activation_status: "active" as const,
    active_discipline_names: ["Karate"],
    active_disciplines: [
      {
        id: `dddddddd-1111-4222-8333-44444444444${id === ANA_ID ? "1" : "2"}`,
        discipline_name: "Karate",
        next_due_date: null,
        billing_mode: "monthly" as const,
        level_name: null,
        level_color: null,
      },
    ],
  };
}

const STUDENTS = [
  makeStudent(ANA_ID, "Ana", "Torres"),
  makeStudent(BRUNO_ID, "Bruno", "Vega"),
];

/**
 * Mirrors how the directory owns the selection: the bar counts it, the cards
 * toggle it, and the shared confirmation clears it once it commits.
 */
function SelectionHarness({ canManage = true }: { canManage?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedStudents = STUDENTS.filter((student) =>
    selectedIds.has(student.id)
  );

  function toggleStudent(studentId: string, nextSelected: boolean) {
    setSelectedIds((previous) => {
      const nextSelection = new Set(previous);

      if (nextSelected) {
        nextSelection.add(studentId);
      } else {
        nextSelection.delete(studentId);
      }

      return nextSelection;
    });
  }

  function clearSelection() {
    setIsDialogOpen(false);
    setSelectedIds(new Set());
  }

  return (
    <div>
      <StudentSelectionBar
        count={selectedStudents.length}
        onClear={clearSelection}
        onRequestDeactivate={() => setIsDialogOpen(true)}
      />

      {STUDENTS.map((student) => (
        <StudentCard
          key={student.id}
          student={student}
          branchId={BRANCH_ID}
          branches={BRANCHES}
          status="active"
          canManage={canManage}
          selected={selectedIds.has(student.id)}
          onSelectedChange={(nextSelected) =>
            toggleStudent(student.id, nextSelected)
          }
          onActivated={vi.fn()}
          timeZone={TIME_ZONE}
        />
      ))}

      <BulkDeactivateDialog
        students={selectedStudents}
        branchId={BRANCH_ID}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onDeactivated={clearSelection}
      />
    </div>
  );
}

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function renderHarness(canManage = true): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<SelectionHarness canManage={canManage} />);
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

function cardCheckboxes(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')];
}

function buttonWithText(
  container: HTMLElement,
  text: string
): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes(text)
  );
}

function dialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="alert-dialog-content"]'
  );
}

function click(element: HTMLElement | undefined) {
  act(() => {
    element?.click();
  });
}

describe("Student table selection column", () => {
  const baseOptions = {
    branchId: BRANCH_ID,
    branches: BRANCHES,
    status: "active" as const,
    onActivated: vi.fn(),
    timeZone: TIME_ZONE,
  };

  function columnIdentifiers(
    columns: ReturnType<typeof getStudentColumns>
  ): (string | undefined)[] {
    return columns.map((column) =>
      "accessorKey" in column && column.accessorKey !== undefined
        ? String(column.accessorKey)
        : column.id
    );
  }

  it("keeps the Acciones column first when bulk selection does not apply", () => {
    const identifiers = columnIdentifiers(
      getStudentColumns({ ...baseOptions, canManage: false })
    );

    expect(identifiers[0]).toBe("actions");
    expect(identifiers).not.toContain("select");
  });

  it("puts the select column in front when the caller can manage the active tab", () => {
    const identifiers = columnIdentifiers(
      getStudentColumns({
        ...baseOptions,
        canManage: true,
        selection: {
          selectedIds: new Set<string>(),
          isAllSelected: false,
          isPartiallySelected: false,
          onToggleRow: vi.fn(),
          onToggleAll: vi.fn(),
        },
      })
    );

    expect(identifiers[0]).toBe("select");
    expect(identifiers[1]).toBe("actions");
  });
});

describe("Student selection — bulk deactivate", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.deactivateStudents.mockResolvedValue({
      success: true,
      data: { deactivated: STUDENTS.length },
    });
    mocks.reactivateStudent.mockResolvedValue({ success: true, data: {} });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("offers no bulk action until something is selected", () => {
    rendered = renderHarness();

    expect(cardCheckboxes(rendered.container)).toHaveLength(STUDENTS.length);
    for (const checkbox of cardCheckboxes(rendered.container)) {
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    }
    expect(rendered.container.textContent).not.toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(STUDENTS.length)
    );
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    ).toBeUndefined();
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.CLEAR_SELECTION
      )
    ).toBeUndefined();
  });

  it("counts the selected cards, labels each checkbox and opens the confirmation", () => {
    rendered = renderHarness();

    const [anaCheckbox, brunoCheckbox] = cardCheckboxes(rendered.container);
    expect(anaCheckbox.getAttribute("aria-label")).toBe(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECT_ROW_LABEL("Ana Torres")
    );
    expect(brunoCheckbox.getAttribute("aria-label")).toBe(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECT_ROW_LABEL("Bruno Vega")
    );

    click(anaCheckbox);
    click(brunoCheckbox);

    expect(rendered.container.textContent).toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(2)
    );
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )?.disabled
    ).toBe(false);

    click(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    );

    expect(dialogContent()?.textContent).toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.CONFIRMATION_TITLE(2)
    );
  });

  it("deactivates the selected cards and clears the selection afterwards", async () => {
    rendered = renderHarness();

    const [anaCheckbox, brunoCheckbox] = cardCheckboxes(rendered.container);
    click(anaCheckbox);
    click(brunoCheckbox);

    click(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    );

    const confirm = [
      ...(dialogContent()?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ].find((button) =>
      button.textContent?.includes(
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    );

    await act(async () => {
      confirm?.click();
    });
    await act(async () => {});

    expect(mocks.deactivateStudents).toHaveBeenCalledWith({
      student_ids: [ANA_ID, BRUNO_ID],
      branch_id: BRANCH_ID,
    });
    expect(rendered.container.textContent).not.toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(2)
    );
    for (const checkbox of cardCheckboxes(rendered.container)) {
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    }
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    ).toBeUndefined();
  });

  it("clears the selection with the bar action", () => {
    rendered = renderHarness();

    const [anaCheckbox] = cardCheckboxes(rendered.container);
    click(anaCheckbox);
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    ).toBeDefined();

    click(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.CLEAR_SELECTION
      )
    );

    expect(rendered.container.textContent).not.toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(1)
    );
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    ).toBeUndefined();
    for (const checkbox of cardCheckboxes(rendered.container)) {
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("shows no checkboxes to a caller who cannot manage the branch", () => {
    rendered = renderHarness(false);

    expect(cardCheckboxes(rendered.container)).toHaveLength(0);
    expect(rendered.container.textContent).not.toContain(
      STUDENT_BULK_ACTIONS_MESSAGES.SELECTED_COUNT(1)
    );
    expect(
      buttonWithText(
        rendered.container,
        STUDENT_BULK_ACTIONS_MESSAGES.DEACTIVATE_SELECTED
      )
    ).toBeUndefined();
  });
});
