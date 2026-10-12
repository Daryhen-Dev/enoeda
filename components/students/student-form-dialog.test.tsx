// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STUDENT_FORM_MESSAGES, STUDENT_MISSING_DATA_MESSAGES } from "@/lib/localization/es-ec";

const mocks = vi.hoisted(() => ({
  createStudent: vi.fn(),
  enrollStudent: vi.fn(),
  getStudentById: vi.fn(),
  updateStudent: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/domain/students/actions", () => ({
  createStudent: mocks.createStudent,
  getStudentById: mocks.getStudentById,
  updateStudent: mocks.updateStudent,
}));

vi.mock("@/lib/domain/disciplines/actions", () => ({
  enrollStudent: mocks.enrollStudent,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { StudentFormDialog } from "./student-form-dialog";
import { StudentDetailHeader } from "./student-detail-header";

const BRANCH_ID = "bbbbbbbb-1111-4222-a333-444444444444";
const STUDENT_ID = "cccccccc-1111-4222-a333-444444444444";
const BRANCHES = [{ id: BRANCH_ID, name: "Sucursal Norte" }];

const COMPLETE_STUDENT = {
  id: STUDENT_ID,
  branch_id: BRANCH_ID,
  first_name: "Juan",
  surname: "Pérez",
  national_id: "12345678",
  email: "juan@example.com",
  phone: null,
  date_of_birth: new Date("2000-01-01T00:00:00.000Z"),
  is_active: true,
};

interface Rendered {
  container: HTMLElement;
  unmount(): void;
}

function renderUi(ui: React.ReactElement): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
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

function queryButtonByText(
  scope: HTMLElement | Document,
  text: string
): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes(text)
  );
}

function getInputByLabel(labelText: string): HTMLInputElement | undefined {
  const label = [...document.querySelectorAll("label")].find(
    (label) => label.textContent === labelText
  );
  const id = label?.htmlFor;
  return id
    ? (document.getElementById(id) as HTMLInputElement | null) ?? undefined
    : undefined;
}

function setInputValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function openCreateDialog() {
  const trigger = queryButtonByText(document, "Crear");
  expect(trigger).toBeDefined();

  act(() => {
    trigger!.click();
  });

  const form = document.querySelector("form");
  expect(form).not.toBeNull();
  return form!;
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
  });
  await act(async () => {});
}

describe("StudentFormDialog — minimal creation", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.createStudent.mockResolvedValue({
      success: true,
      data: { id: STUDENT_ID },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("submits with only names, storing identity fields as null", async () => {
    rendered = renderUi(
      <StudentFormDialog branches={BRANCHES} lockedBranchId={BRANCH_ID} />
    );

    const form = await openCreateDialog();

    act(() => {
      setInputValue(getInputByLabel("Nombre")!, "Juan");
      setInputValue(getInputByLabel("Apellido")!, "Pérez");
    });

    await submit(form);

    expect(mocks.createStudent).toHaveBeenCalledTimes(1);
    expect(mocks.createStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Juan",
        surname: "Pérez",
        national_id: null,
        email: null,
        date_of_birth: null,
        phone: null,
        is_active: true,
      })
    );
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("marks only the name fields as required in the UI", async () => {
    rendered = renderUi(
      <StudentFormDialog branches={BRANCHES} lockedBranchId={BRANCH_ID} />
    );

    await openCreateDialog();

    const labels = [...document.querySelectorAll("label")].map(
      (label) => label.textContent ?? ""
    );

    expect(labels).toContain("Nombre");
    expect(labels).toContain("Apellido");
    // National id, email, date of birth and phone carry the optional suffix.
    const optionalLabels = labels.filter((label) =>
      label.includes(STUDENT_FORM_OPTIONAL_SUFFIX)
    );
    expect(optionalLabels).toHaveLength(4);
    expect(labels.join(" ")).not.toContain("es obligatorio");
  });

  it("sends null for cleared optional fields in edit mode", async () => {
    mocks.updateStudent.mockResolvedValue({
      success: true,
      data: { id: STUDENT_ID },
    });
    mocks.getStudentById.mockResolvedValue({
      success: true,
      data: COMPLETE_STUDENT,
    });

    rendered = renderUi(
      <StudentFormDialog
        branches={BRANCHES}
        studentId={STUDENT_ID}
        branchId={BRANCH_ID}
      />
    );

    const editTrigger = queryButtonByText(document, "Editar");
    expect(editTrigger).toBeDefined();

    act(() => {
      editTrigger!.click();
    });
    await act(async () => {});

    const form = document.querySelector("form");
    expect(form).not.toBeNull();

    const nationalIdInput = getInputByLabel(
      STUDENT_FORM_MESSAGES.NATIONAL_ID_OPTIONAL_LABEL
    );
    expect(nationalIdInput).toBeDefined();
    act(() => {
      setInputValue(nationalIdInput!, "");
    });

    await submit(form!);

    expect(mocks.updateStudent).toHaveBeenCalledTimes(1);
    expect(mocks.updateStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: STUDENT_ID,
        national_id: null,
      }),
      BRANCH_ID
    );
  });
});

const STUDENT_FORM_OPTIONAL_SUFFIX = "(opcional)";

describe("StudentDetailHeader — Datos incompletos badge", () => {
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
  });

  it("shows the badge listing missing fields when data is incomplete", () => {
    rendered = renderUi(
      <StudentDetailHeader
        student={{
          ...COMPLETE_STUDENT,
          national_id: null,
          email: null,
          date_of_birth: null,
        }}
        backHref="/dashboard/students"
        todayDateOnly="2026-01-05"
      />
    );

    const badge = rendered.container.querySelector(
      `[aria-label^="${STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE}"]`
    );
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain(
      STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE
    );
    // The accessible label lists the missing fields, not just the color.
    const missingLabels = STUDENT_MISSING_DATA_MESSAGES.MISSING_FIELD_LABELS;
    const expected = [
      missingLabels.national_id,
      missingLabels.email,
      missingLabels.date_of_birth,
    ].join(", ");
    expect(badge!.getAttribute("aria-label")).toContain(expected);
  });

  it("hides the badge for a complete student", () => {
    rendered = renderUi(
      <StudentDetailHeader
        student={COMPLETE_STUDENT}
        backHref="/dashboard/students"
        todayDateOnly="2026-01-05"
      />
    );

    expect(rendered.container.textContent).not.toContain(
      STUDENT_MISSING_DATA_MESSAGES.INCOMPLETE_BADGE
    );
  });
});
